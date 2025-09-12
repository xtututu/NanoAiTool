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
                'imageMethod': '图片生成方式',
                'metLabelOne': '文生图',
                'metLabelTwo': '图片编辑',
                'imagePrompt': '提示词',
                'refImage': '参考图片',
            },
            'en-US': {
                'videoMethod': 'Image generation method',
                'metLabelOne': 'Text-to-image',
                'metLabelTwo': 'Image-to-image',
                'imagePrompt': 'Image editing prompt',
                'refImage': 'Reference image',
            },
            'ja-JP': {
                'videoMethod': '画像生成方式',
                'metLabelOne': 'テキスト-to-画像',
                'metLabelTwo': 'イメージ-to-画像',
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
            key: 'imageMethod',
            label: t('imageMethod'),
            component: block_basekit_server_api_1.FieldComponent.Radio,
            defaultValue: { label: t('metLabelOne'), value: 'textToImage' },
            props: {
                options: [
                    { label: t('metLabelOne'), value: 'textToImage' },
                    { label: t('metLabelTwo'), value: 'imageToImage' },
                ]
            },
        },
        {
            key: 'imagePrompt',
            label: t('imagePrompt'),
            component: block_basekit_server_api_1.FieldComponent.Input,
            props: {
                placeholder: '请输入图片提示词',
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
            console.log("==================");
            // 参数校验
            if (((imageMethod.value === 'imageToImage') && !refImage)) {
                debugLog({ type: 'error', message: "请上传参考图片", code: 400 });
                return {
                    code: block_basekit_server_api_1.FieldCode.Success,
                    data: { id: `错误: 请上传参考图片` },
                    msg: "请上传参考图片"
                };
            }
            if ((imageMethod.value === 'textToImage' && refImage)) {
                debugLog({ type: 'error', message: "文生图片请不要上传参考图片", code: 400 });
                return {
                    code: block_basekit_server_api_1.FieldCode.Success,
                    data: { id: `错误: 文生图片请不要上传参考图片` },
                    msg: "文生图片请不要上传参考图片"
                };
            }
            const createImageUrl = imageMethod.value === 'textToImage'
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
                console.log('refImage:', refImage);
                // 获取参考图片的Buffer
                const formData = new FormData();
                for (let i = 0; i < refImage.length; i++) {
                    const imageBuffer = await remoteUrlToBuffer(refImage[i].tmp_url);
                    debugLog({ message: `图片${i}转Buffer成功，大小：${(imageBuffer.length / 1024).toFixed(2)}KB` });
                    console.log({ message: `图片${i}转Buffer成功，大小：${(imageBuffer.length / 1024).toFixed(2)}KB` });
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
                throw new Error(`API请求失败: ${taskResp.status} ${taskResp.statusText}`);
            }
            const initialResult = await taskResp.json();
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
            return { code: block_basekit_server_api_1.FieldCode.Error };
        }
    }
});
exports.default = block_basekit_server_api_1.basekit;
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiaW5kZXguanMiLCJzb3VyY2VSb290IjoiIiwic291cmNlcyI6WyIuLi8uLi8uLi9zcmMvaW5kZXgudHMiXSwibmFtZXMiOltdLCJtYXBwaW5ncyI6Ijs7QUFBQSxtRkFBK0g7QUFFL0gsTUFBTSxFQUFFLENBQUMsRUFBRSxHQUFHLGdDQUFLLENBQUM7QUFDcEIsTUFBTSxLQUFLLEdBQUcsT0FBTyxDQUFDLE9BQU8sQ0FBQyxDQUFDO0FBQy9CLE1BQU0sUUFBUSxHQUFHLE9BQU8sQ0FBQyxXQUFXLENBQUMsQ0FBQztBQUV0QyxNQUFNLFFBQVEsR0FBRyxDQUFDLFdBQVcsRUFBRSxlQUFlLEVBQUUsa0JBQWtCLEVBQUUsZUFBZSxFQUFDLGlCQUFpQixFQUFDLG1CQUFtQixDQUFDLENBQUM7QUFDM0gsa0NBQU8sQ0FBQyxhQUFhLENBQUMsQ0FBQyxHQUFHLFFBQVEsRUFBRSwwQkFBMEIsQ0FBQyxDQUFDLENBQUM7QUFFakUsa0NBQU8sQ0FBQyxRQUFRLENBQUM7SUFDZixJQUFJLEVBQUU7UUFDSixRQUFRLEVBQUU7WUFDUixPQUFPLEVBQUU7Z0JBQ1AsYUFBYSxFQUFFLFFBQVE7Z0JBQ3ZCLGFBQWEsRUFBRSxLQUFLO2dCQUNwQixhQUFhLEVBQUUsTUFBTTtnQkFDckIsYUFBYSxFQUFFLEtBQUs7Z0JBQ3BCLFVBQVUsRUFBRSxNQUFNO2FBQ25CO1lBQ0QsT0FBTyxFQUFFO2dCQUNQLGFBQWEsRUFBRSx5QkFBeUI7Z0JBQ3hDLGFBQWEsRUFBRSxlQUFlO2dCQUM5QixhQUFhLEVBQUUsZ0JBQWdCO2dCQUMvQixhQUFhLEVBQUUsc0JBQXNCO2dCQUNyQyxVQUFVLEVBQUUsaUJBQWlCO2FBQzlCO1lBQ0QsT0FBTyxFQUFFO2dCQUNOLGFBQWEsRUFBRSxRQUFRO2dCQUN4QixhQUFhLEVBQUUsWUFBWTtnQkFDM0IsYUFBYSxFQUFFLFlBQVk7Z0JBQzNCLGFBQWEsRUFBRSxTQUFTO2dCQUN4QixVQUFVLEVBQUUsTUFBTTthQUNuQjtTQUNGO0tBQ0Y7SUFFRCxjQUFjLEVBQUU7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