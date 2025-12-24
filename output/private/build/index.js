"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const block_basekit_server_api_1 = require("@lark-opdev/block-basekit-server-api");
const { t } = block_basekit_server_api_1.field;
const feishuDm = ['feishu.cn', 'feishucdn.com', 'larksuitecdn.com', 'larksuite.com', 'api.xunkecloud.cn',];
block_basekit_server_api_1.basekit.addDomainList([...feishuDm, 'api.exchangerate-api.com']);
block_basekit_server_api_1.basekit.addField({
    i18n: {
        messages: {
            'zh-CN': {
                'videoMethod': '模型选择',
                'imagePrompt': '提示词',
                'refImage': '参考图片',
                'modelBrand': '迅客',
            },
            'en-US': {
                'videoMethod': 'Model selection',
                'imagePrompt': 'Image editing prompt',
                'refImage': 'Reference image',
                'modelBrand': 'Xunke',
            },
            'ja-JP': {
                'videoMethod': '画像生成方式',
                'imagePrompt': '画像編集提示詞',
                'refImage': '参考画像',
                'modelBrand': '迅客',
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
            defaultValue: { label: t('modelBrand') + ' Na', value: 'nano-banana' },
            props: {
                options: [
                    { label: t('modelBrand') + ' Na', value: 'nano-banana' },
                    { label: t('modelBrand') + ' Na-Pro', value: 'nano-banana-pro' },
                    { label: t('modelBrand') + ' Na-Pro-4k', value: 'nano-banana-pro_4k' }
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
        const createErrorResponse = (name, videoUrl) => ({
            code: block_basekit_server_api_1.FieldCode.Success,
            data: [{
                    name: `${name}.mp4`,
                    content: videoUrl,
                    contentType: 'attachment/url'
                }]
        });
        const ERROR_VIDEOS = {
            DEFAULT: 'https://pay.xunkecloud.cn/image/Wrong.mp4',
            OVERRUN: 'https://pay.xunkecloud.cn/image/Overrun.mp4',
            NO_CHANNEL: 'https://pay.xunkecloud.cn/image/unusual.mp4',
            INSUFFICIENT: 'https://pay.xunkecloud.cn/image/Insufficient.mp4',
            INVALID_TOKEN: 'https://pay.xunkecloud.cn/image/tokenError.mp4'
        };
        try {
            // 创建错误响应的辅助函数
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
            console.log('jsonRequestOptions:', jsonRequestOptions);
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
            // let chatfireNanoUrl = initialResult.data[0].url;
            let imageUrl = initialResult.data[0].url;
            // if (!chatfireNanoUrl) {
            //   throw new Error('未获取到图片URL');
            // }
            // // 调用上传接口
            //   const uploadUrl = 'http://api.xunkecloud.cn/api/image/upload';
            //   const uploadOptions = {
            //     method: 'POST',
            //     headers: {'Content-Type': 'application/json'},
            //     body: JSON.stringify({
            //       image_url: chatfireNanoUrl
            //     })
            //   };
            //   debugLog({'=2 调用上传接口': {uploadUrl, chatfireNanoUrl}});
            //   let uploadResp = await context.fetch(uploadUrl, uploadOptions, 'auth_id_1');
            //   const uploadResult = await uploadResp.json();
            // let imageUrl = "http://api.xunkecloud.cn"+uploadResult.image_url;
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
        catch (error) {
            const errorMessage = String(error);
            debugLog({ '异常错误': errorMessage });
            // 根据错误类型返回相应的错误视频
            if (errorMessage.includes('无可用渠道')) {
                debugLog({ message: '无可用渠道', errorType: '渠道错误', errorMessage });
                return createErrorResponse('捷径异常', ERROR_VIDEOS.NO_CHANNEL);
            }
            else if (errorMessage.includes('令牌额度已用尽')) {
                debugLog({ message: '令牌额度已用尽', errorType: '余额不足', errorMessage });
                return createErrorResponse('余额耗尽', ERROR_VIDEOS.INSUFFICIENT);
            }
            else if (errorMessage.includes('无效的令牌')) {
                debugLog({ message: '无效的令牌', errorType: '令牌错误', errorMessage });
                return createErrorResponse('无效的令牌', ERROR_VIDEOS.INVALID_TOKEN);
            }
            // 未知错误
            return {
                code: block_basekit_server_api_1.FieldCode.Error
            };
        }
    }
});
exports.default = block_basekit_server_api_1.basekit;
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiaW5kZXguanMiLCJzb3VyY2VSb290IjoiIiwic291cmNlcyI6WyIuLi8uLi8uLi9zcmMvaW5kZXgudHMiXSwibmFtZXMiOltdLCJtYXBwaW5ncyI6Ijs7QUFBQSxtRkFBK0g7QUFDL0gsTUFBTSxFQUFFLENBQUMsRUFBRSxHQUFHLGdDQUFLLENBQUM7QUFHcEIsTUFBTSxRQUFRLEdBQUcsQ0FBQyxXQUFXLEVBQUUsZUFBZSxFQUFFLGtCQUFrQixFQUFFLGVBQWUsRUFBQyxtQkFBbUIsRUFBRSxDQUFDO0FBQzFHLGtDQUFPLENBQUMsYUFBYSxDQUFDLENBQUMsR0FBRyxRQUFRLEVBQUUsMEJBQTBCLENBQUMsQ0FBQyxDQUFDO0FBRWpFLGtDQUFPLENBQUMsUUFBUSxDQUFDO0lBQ2YsSUFBSSxFQUFFO1FBQ0osUUFBUSxFQUFFO1lBQ1IsT0FBTyxFQUFFO2dCQUNQLGFBQWEsRUFBRSxNQUFNO2dCQUNyQixhQUFhLEVBQUUsS0FBSztnQkFDcEIsVUFBVSxFQUFFLE1BQU07Z0JBQ2xCLFlBQVksRUFBQyxJQUFJO2FBQ2xCO1lBQ0QsT0FBTyxFQUFFO2dCQUNQLGFBQWEsRUFBRSxpQkFBaUI7Z0JBQ2hDLGFBQWEsRUFBRSxzQkFBc0I7Z0JBQ3JDLFVBQVUsRUFBRSxpQkFBaUI7Z0JBQzdCLFlBQVksRUFBQyxPQUFPO2FBQ3JCO1lBQ0QsT0FBTyxFQUFFO2dCQUNQLGFBQWEsRUFBRSxRQUFRO2dCQUN2QixhQUFhLEVBQUUsU0FBUztnQkFDeEIsVUFBVSxFQUFFLE1BQU07Z0JBQ2xCLFlBQVksRUFBQyxJQUFJO2FBQ2xCO1NBQ0Y7S0FDRjtJQUVELGNBQWMsRUFBRTtRQUNkO1lBQ0UsRUFBRSxFQUFFLFdBQVc7WUFDZixRQUFRLEVBQUUsWUFBWTtZQUN0QixJQUFJLEVBQUUsNENBQWlCLENBQUMsaUJBQWlCO1lBQ3pDLFFBQVEsRUFBRSxJQUFJO1lBQ2QsZUFBZSxFQUFFLGdDQUFnQztZQUNqRCxLQUFLLEVBQUUsTUFBTTtZQUNiLElBQUksRUFBRTtnQkFDSixLQUFLLEVB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