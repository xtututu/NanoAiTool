"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const block_basekit_server_api_1 = require("@lark-opdev/block-basekit-server-api");
const { t } = block_basekit_server_api_1.field;
const https = require("https");
const FormData = require("form-data");
const feishuDm = ['feishu.cn', 'feishucdn.com', 'larksuitecdn.com', 'larksuite.com', 'api.chatfire.cn', 'api.xunkecloud.cn', 'token.yishangcloud.cn'];
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
                    { label: 'nano-banana-pro', value: 'nano-banana-pro' },
                    { label: 'nano-banana-pro_4k', value: 'nano-banana-pro_4k' },
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
        const { videoMethod, imagePrompt, refImage } = formItemParams;
        let englishPrompt = imagePrompt;
        function debugLog(arg) {
            console.log(JSON.stringify({
                timestamp: new Date().toISOString(),
                ...arg
            }));
        }
        try {
            const createImageUrl = `http://api.xunkecloud.cn/v1/images/generations`;
            // 提取图片链接函数
            function extractImageUrls(imageData) {
                if (!imageData || !Array.isArray(imageData)) {
                    return [];
                }
                const urls = [];
                imageData.forEach((item) => {
                    if (item.tmp_url) {
                        // 清理URL中的反引号和空格
                        const cleanUrl = item.tmp_url.replace(/[`\s]/g, '');
                        urls.push(cleanUrl);
                    }
                });
                return urls;
            }
            let taskResp;
            const jsonRequestOptions = {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    model: videoMethod.value,
                    "prompt": imagePrompt,
                    "image": extractImageUrls(refImage),
                    "response_format": "url"
                })
            };
            taskResp = await context.fetch(createImageUrl, jsonRequestOptions, 'auth_id_1');
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
            console.log('initialResult:', initialResult.data);
            // 检查API返回的余额耗尽错误
            if (!initialResult || !initialResult.data || !Array.isArray(initialResult.data) || initialResult.data.length === 0) {
                throw new Error('API响应数据格式不正确或为空');
            }
            let chatfireNanoUrl = initialResult.data[0].url;
            if (!chatfireNanoUrl) {
                throw new Error('未获取到图片URL');
            }
            // 调用上传接口
            const uploadUrl = 'http://token.yishangcloud.cn/api/image/upload';
            const uploadOptions = {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    image_url: chatfireNanoUrl
                })
            };
            debugLog({ '=2 调用上传接口': { uploadUrl, chatfireNanoUrl } });
            let uploadResp = await context.fetch(uploadUrl, uploadOptions, 'auth_id_1');
            const uploadResult = await uploadResp.json();
            let imageUrl = "http://token.yishangcloud.cn" + uploadResult.image_url;
            console.log('imageUrl:', imageUrl);
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
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiaW5kZXguanMiLCJzb3VyY2VSb290IjoiIiwic291cmNlcyI6WyIuLi8uLi8uLi9zcmMvaW5kZXgudHMiXSwibmFtZXMiOltdLCJtYXBwaW5ncyI6Ijs7QUFBQSxtRkFBK0g7QUFFL0gsTUFBTSxFQUFFLENBQUMsRUFBRSxHQUFHLGdDQUFLLENBQUM7QUFDcEIsTUFBTSxLQUFLLEdBQUcsT0FBTyxDQUFDLE9BQU8sQ0FBQyxDQUFDO0FBQy9CLE1BQU0sUUFBUSxHQUFHLE9BQU8sQ0FBQyxXQUFXLENBQUMsQ0FBQztBQUV0QyxNQUFNLFFBQVEsR0FBRyxDQUFDLFdBQVcsRUFBRSxlQUFlLEVBQUUsa0JBQWtCLEVBQUUsZUFBZSxFQUFDLGlCQUFpQixFQUFDLG1CQUFtQixFQUFFLHVCQUF1QixDQUFDLENBQUM7QUFDcEosa0NBQU8sQ0FBQyxhQUFhLENBQUMsQ0FBQyxHQUFHLFFBQVEsRUFBRSwwQkFBMEIsQ0FBQyxDQUFDLENBQUM7QUFFakUsa0NBQU8sQ0FBQyxRQUFRLENBQUM7SUFDZixJQUFJLEVBQUU7UUFDSixRQUFRLEVBQUU7WUFDUixPQUFPLEVBQUU7Z0JBQ1AsYUFBYSxFQUFFLE1BQU07Z0JBQ3JCLGFBQWEsRUFBRSxLQUFLO2dCQUNwQixVQUFVLEVBQUUsTUFBTTthQUNuQjtZQUNELE9BQU8sRUFBRTtnQkFDUCxhQUFhLEVBQUUsaUJBQWlCO2dCQUNoQyxhQUFhLEVBQUUsc0JBQXNCO2dCQUNyQyxVQUFVLEVBQUUsaUJBQWlCO2FBQzlCO1lBQ0QsT0FBTyxFQUFFO2dCQUNQLGFBQWEsRUFBRSxRQUFRO2dCQUN2QixhQUFhLEVBQUUsU0FBUztnQkFDeEIsVUFBVSxFQUFFLE1BQU07YUFDbkI7U0FDRjtLQUNGO0lBRUQsY0FBYyxFQUFFO1FBQ2Q7WUFDRSxFQUFFLEVBQUUsV0FBVztZQUNmLFFBQVEsRUFBRSxZQUFZO1lBQ3RCLElBQUksRUFBRSw0Q0FBaUIsQ0FBQyxpQkFBaUI7WUFDekMsUUFBUSxFQUFFLElBQUk7WUFDZCxlQUFlLEVBQUUsZ0NBQWdD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