"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const block_basekit_server_api_1 = require("@lark-opdev/block-basekit-server-api");
const { t } = block_basekit_server_api_1.field;
const https = require("https");
const FormData = require("form-data");
const feishuDm = ['feishu.cn', 'feishucdn.com', 'larksuitecdn.com', 'larksuite.com', 'api.chatfire.cn', 'api.xunkecloud.cn'];
block_basekit_server_api_1.basekit.addDomainList([...feishuDm, 'api.exchangerate-api.com']);
block_basekit_server_api_1.basekit.addField({
    i18n: {
        messages: {
            'zh-CN': {
                'videoMethod': '模型选择',
                'imagePrompt': '提示词',
                'refImage': '参考图片',
            },
            'en-US': {
                'videoMethod': 'Model selection',
                'imagePrompt': 'Image editing prompt',
                'refImage': 'Reference image',
            },
            'ja-JP': {
                'videoMethod': '画像生成方式',
                'imagePrompt': '画像編集提示詞',
                'refImage': '参考画像',
            },
        }
    },
    authorizations: [
        {
            id: 'auth_id_1',
            platform: 'xunkecloud',
            type: block_basekit_server_api_1.AuthorizationType.HeaderBearerToken,
            required: true,
            instructionsUrl: "http://api.xunkecloud.cn/login",
            label: '关联账号',
            icon: {
                light: '',
                dark: ''
            }
        }
    ],
    formItems: [
        {
            key: 'videoMethod',
            label: t('videoMethod'),
            component: block_basekit_server_api_1.FieldComponent.SingleSelect,
            defaultValue: { label: 'nano-banana', value: 'nano-banana' },
            props: {
                options: [
                    { label: 'nano-banana', value: 'nano-banana' },
                    { label: 'gemini-2.5-flash-image', value: 'gemini-2.5-flash-image' },
                ]
            },
        },
        {
            key: 'imagePrompt',
            label: t('imagePrompt'),
            component: block_basekit_server_api_1.FieldComponent.Input,
            props: {
                placeholder: '自然语言说出要求，例如：将图片中的手机去掉（使用翻译后提示词效果更佳）',
            },
            validator: {
                required: true,
            }
        },
        {
            key: 'refImage',
            label: t('refImage'),
            component: block_basekit_server_api_1.FieldComponent.FieldSelect,
            props: {
                supportType: [block_basekit_server_api_1.FieldType.Attachment],
            }
        }
    ],
    resultType: {
        type: block_basekit_server_api_1.FieldType.Attachment
    },
    execute: async (formItemParams, context) => {
        const { imageMethod, imagePrompt, refImage } = formItemParams;
        let englishPrompt = imagePrompt;
        function debugLog(arg) {
            console.log(JSON.stringify({
                timestamp: new Date().toISOString(),
                ...arg
            }));
        }
        try {
            const createImageUrl = (!refImage || refImage.length === 0)
                ? `http://api.xunkecloud.cn/v1/images/generations`
                : `http://api.xunkecloud.cn/v1/images/edits`;
            console.log("createImageUrl:", createImageUrl);
            // 远程图片转Buffer工具函数
            async function remoteUrlToBuffer(imageUrl) {
                return new Promise((resolve, reject) => {
                    const request = https.get(imageUrl, (response) => {
                        response.setTimeout(30000);
                        if (response.statusCode !== 200) {
                            reject(new Error(`获取图片失败：状态码 ${response.statusCode}`));
                            response.resume();
                            return;
                        }
                        const chunks = [];
                        response.on("data", (chunk) => chunks.push(chunk));
                        response.on("end", () => {
                            const buffer = Buffer.concat(chunks);
                            const contentType = response.headers["content-type"];
                            if (!contentType?.startsWith("image/")) {
                                reject(new Error("远程资源不是图片格式"));
                                return;
                            }
                            resolve(buffer);
                        });
                    });
                    request.on("timeout", () => {
                        request.destroy();
                        reject(new Error("获取图片超时（30秒）"));
                    });
                    request.on("error", (error) => {
                        reject(new Error(`请求图片出错：${error.message}`));
                    });
                });
            }
            let taskResp;
            // 图片编辑/图生图处理逻辑
            if (createImageUrl.includes('images/edits')) {
                // 获取参考图片的Buffer
                const formData = new FormData();
                debugLog({ message: `开始上传图片，参考图片数量: ${refImage.length}` });
                for (let i = 0; i < refImage.length; i++) {
                    const imageBuffer = await remoteUrlToBuffer(refImage[i].tmp_url);
                    formData.append(`image`, imageBuffer, {
                        filename: `reference-${Date.now()}-${i}.webp`,
                        contentType: "image/webp",
                        knownLength: imageBuffer.length
                    });
                }
                formData.append("prompt", imagePrompt);
                formData.append("model", "nano-image");
                formData.append("response_format", "b64_json");
                // 准备请求选项（已修复BodyInit类型错误）
                const editRequestOptions = {
                    method: 'POST',
                    headers: {
                        ...formData.getHeaders(),
                        "User-Agent": "PostmanRuntime/7.36.3"
                    },
                    body: formData,
                    timeout: 300000 // 5分钟超时
                };
                debugLog({ message: "开始发送图片编辑请求" });
                console.log('editRequestOptions:', editRequestOptions);
                taskResp = await context.fetch(createImageUrl, editRequestOptions, 'auth_id_1');
            }
            // 文生图处理逻辑
            else {
                const jsonRequestOptions = {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        model: "nano-image-hd",
                        "prompt": imagePrompt,
                    })
                };
                console.log('jsonRequestOptions:', jsonRequestOptions);
                taskResp = await context.fetch(createImageUrl, jsonRequestOptions, 'auth_id_1');
            }
            if (!taskResp) {
                throw new Error('请求未能成功发送');
            }
            debugLog({ '=1 图片创建接口结果': taskResp });
            if (!taskResp.ok) {
                const errorData = await taskResp.json().catch(() => ({}));
                console.error('API请求失败:', taskResp.status, errorData);
                // 检查HTTP错误响应中的无效令牌错误
                if (errorData.error && errorData.error.message) {
                    throw new Error(errorData.error.message);
                }
                throw new Error(`API请求失败: ${taskResp.status} ${taskResp.statusText}`);
            }
            const initialResult = await taskResp.json();
            // 检查API返回的余额耗尽错误
            if (!initialResult || !initialResult.data || !Array.isArray(initialResult.data) || initialResult.data.length === 0) {
                throw new Error('API响应数据格式不正确或为空');
            }
            let imageUrl = initialResult.data[0].url;
            console.log('imageUrl:', imageUrl);
            if (!imageUrl) {
                throw new Error('未获取到图片URL');
            }
            const url = [
                {
                    type: 'url',
                    text: englishPrompt,
                    link: imageUrl
                }
            ];
            return {
                code: block_basekit_server_api_1.FieldCode.Success, // 0 表示请求成功
                // data 类型需与下方 resultType 定义一致
                data: (url.map(({ link }, index) => {
                    if (!link || typeof link !== 'string') {
                        return undefined;
                    }
                    const name = link.split('/').slice(-1)[0];
                    return {
                        name: name + '.png',
                        content: link,
                        contentType: "attachment/url"
                    };
                })).filter((v) => v)
            };
        }
        catch (e) {
            console.log('====error', String(e));
            debugLog({ '===999 异常错误': String(e) });
            if (String(e).includes('无可用渠道')) {
                return {
                    code: block_basekit_server_api_1.FieldCode.Success, // 0 表示请求成功
                    // data 类型需与下方 resultType 定义一致
                    data: [{
                            name: "捷径异常" + '.png',
                            content: "https://pay.xunkecloud.cn/image/unusual.png",
                            contentType: "attachment/url"
                        }]
                };
            }
            // 检查错误消息中是否包含余额耗尽的信息
            if (String(e).includes('令牌额度已用尽')) {
                return {
                    code: block_basekit_server_api_1.FieldCode.Success, // 0 表示请求成功
                    // data 类型需与下方 resultType 定义一致
                    data: [{
                            name: "余额耗尽" + '.png',
                            content: "https://pay.xunkecloud.cn/image/Insufficient.png",
                            contentType: "attachment/url"
                        }]
                };
            }
            if (String(e).includes('无效的令牌')) {
                return {
                    code: block_basekit_server_api_1.FieldCode.Success, // 0 表示请求成功
                    data: [
                        {
                            "name": "无效的令牌" + '.png', // 附件名称,需要带有文件格式后缀
                            "content": "https://pay.xunkecloud.cn/image/tokenError.png", // 可通过http.Get 请求直接下载的url.
                            "contentType": "attachment/url", // 固定值
                        }
                    ],
                };
            }
            return { code: block_basekit_server_api_1.FieldCode.Error };
        }
    }
});
exports.default = block_basekit_server_api_1.basekit;
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiaW5kZXguanMiLCJzb3VyY2VSb290IjoiIiwic291cmNlcyI6WyIuLi8uLi8uLi9zcmMvaW5kZXgudHMiXSwibmFtZXMiOltdLCJtYXBwaW5ncyI6Ijs7QUFBQSxtRkFBK0g7QUFFL0gsTUFBTSxFQUFFLENBQUMsRUFBRSxHQUFHLGdDQUFLLENBQUM7QUFDcEIsTUFBTSxLQUFLLEdBQUcsT0FBTyxDQUFDLE9BQU8sQ0FBQyxDQUFDO0FBQy9CLE1BQU0sUUFBUSxHQUFHLE9BQU8sQ0FBQyxXQUFXLENBQUMsQ0FBQztBQUV0QyxNQUFNLFFBQVEsR0FBRyxDQUFDLFdBQVcsRUFBRSxlQUFlLEVBQUUsa0JBQWtCLEVBQUUsZUFBZSxFQUFDLGlCQUFpQixFQUFDLG1CQUFtQixDQUFDLENBQUM7QUFDM0gsa0NBQU8sQ0FBQyxhQUFhLENBQUMsQ0FBQyxHQUFHLFFBQVEsRUFBRSwwQkFBMEIsQ0FBQyxDQUFDLENBQUM7QUFFakUsa0NBQU8sQ0FBQyxRQUFRLENBQUM7SUFDZixJQUFJLEVBQUU7UUFDSixRQUFRLEVBQUU7WUFDUixPQUFPLEVBQUU7Z0JBQ1AsYUFBYSxFQUFFLE1BQU07Z0JBQ3JCLGFBQWEsRUFBRSxLQUFLO2dCQUNwQixVQUFVLEVBQUUsTUFBTTthQUNuQjtZQUNELE9BQU8sRUFBRTtnQkFDUCxhQUFhLEVBQUUsaUJBQWlCO2dCQUNoQyxhQUFhLEVBQUUsc0JBQXNCO2dCQUNyQyxVQUFVLEVBQUUsaUJBQWlCO2FBQzlCO1lBQ0QsT0FBTyxFQUFFO2dCQUNQLGFBQWEsRUFBRSxRQUFRO2dCQUN2QixhQUFhLEVBQUUsU0FBUztnQkFDeEIsVUFBVSxFQUFFLE1BQU07YUFDbkI7U0FDRjtLQUNGO0lBRUQsY0FBYyxFQUFFO1FBQ2Q7WUFDRSxFQUFFLEVBQUUsV0FBVztZQUNmLFFBQVEsRUFBRSxZQUFZO1lBQ3RCLElBQUksRUFBRSw0Q0FBaUIsQ0FBQyxpQkFBaUI7WUFDekMsUUFBUSxFQUFFLElBQUk7WUFDZCxlQUFlLEVBQUUsZ0NBQWdDO1lBQ2pELEtBQUss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