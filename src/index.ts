import { basekit, FieldType, field, FieldComponent, FieldCode, AuthorizationType } from '@lark-opdev/block-basekit-server-api';
const { t } = field;


const feishuDm = ['feishu.cn', 'feishucdn.com', 'larksuitecdn.com', 'larksuite.com','api.xunkecloud.cn',];
basekit.addDomainList([...feishuDm, 'api.exchangerate-api.com']);

basekit.addField({
  i18n: {
    messages: {
      'zh-CN': {
        'videoMethod': '模型选择',
        'imagePrompt': '提示词',
        'refImage': '参考图片',
        'modelBrand':'迅客',
      },
      'en-US': {
        'videoMethod': 'Model selection',
        'imagePrompt': 'Image editing prompt',
        'refImage': 'Reference image',
        'modelBrand':'Xunke',
      },
      'ja-JP': {
        'videoMethod': '画像生成方式',
        'imagePrompt': '画像編集提示詞',
        'refImage': '参考画像',
        'modelBrand':'迅客',
      },
    }
  },

  authorizations: [
    {
      id: 'auth_id_1',
      platform: 'xunkecloud',
      type: AuthorizationType.HeaderBearerToken,
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
      component: FieldComponent.SingleSelect,
      defaultValue: { label: t('modelBrand') +' Na', value: 'nano-banana'},
      props: {
        options: [
          { label: t('modelBrand') +' Na', value: 'nano-banana'},
          { label: t('modelBrand') +' Na-Pro', value: 'nano-banana-pro'},
          { label: t('modelBrand') +' Na-Pro-4k', value: 'nano-banana-pro_4k'}
        ]
      },
    },
    {
      key: 'imagePrompt',
      label: t('imagePrompt'),
      component: FieldComponent.Input,
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
      component: FieldComponent.FieldSelect,
      props: {
        supportType: [FieldType.Attachment],
      }
    }
  ],

  resultType: {
    type: FieldType.Attachment
  },

  execute: async (formItemParams, context) => {
    const { videoMethod, imagePrompt, refImage } = formItemParams;
    let englishPrompt = imagePrompt;

    function debugLog(arg: any) {
      console.log(JSON.stringify({
        timestamp: new Date().toISOString(),
        ...arg
      }));
    }
      const createErrorResponse = (name: string, videoUrl: string) => ({
      code: FieldCode.Success,
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
  

const createImageUrl = `http://api.xunkecloud.cn/v1/images/generations` 
      
      
      // 提取图片链接函数
      function extractImageUrls(imageData: any): string[] {
        
        if (!imageData || !Array.isArray(imageData)) {
          return [];
        }
        
        const urls: string[] = [];
        
        imageData.forEach((item: any) => {
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
          headers: {'Content-Type': 'application/json'},
          body: JSON.stringify({
            model: videoMethod.value,
            "prompt": imagePrompt,
            "image": extractImageUrls(refImage),
            "response_format":"url"
          })
        };

        console.log('jsonRequestOptions:', jsonRequestOptions);
        
        
        taskResp = await context.fetch(createImageUrl, jsonRequestOptions, 'auth_id_1');
      

      if (!taskResp) {
        throw new Error('请求未能成功发送');
      }

      debugLog({'=1 图片创建接口结果': taskResp});
      
      if (!taskResp.ok) {
        const errorData = await taskResp.json().catch(() => ({}));
        console.error('API请求失败:', taskResp.status, errorData);
        
        // 检查HTTP错误响应中的无效令牌错误
        if (errorData.error && errorData.error.message ) {
          
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
          code: FieldCode.Success, // 0 表示请求成功
          // data 类型需与下方 resultType 定义一致
          data: (url.map(({ link }, index) => {            
            if (!link || typeof link !== 'string') {
              return undefined
            }
            const name = link.split('/').slice(-1)[0];
            return {
              name:  name+'.png',
              content: link,
              contentType: "attachment/url"
            }
          })).filter((v) => v)
        };

    } catch (error: any) {
     const errorMessage = String(error);
      debugLog({ '异常错误': errorMessage });

      // 根据错误类型返回相应的错误视频
      if (errorMessage.includes('无可用渠道')) {
        debugLog({ message: '无可用渠道', errorType: '渠道错误', errorMessage });
        return createErrorResponse('捷径异常', ERROR_VIDEOS.NO_CHANNEL);
      } else if (errorMessage.includes('令牌额度已用尽')) {
        debugLog({ message: '令牌额度已用尽', errorType: '余额不足', errorMessage });
        return createErrorResponse('余额耗尽', ERROR_VIDEOS.INSUFFICIENT);
      } else if (errorMessage.includes('无效的令牌')) {
        debugLog({ message: '无效的令牌', errorType: '令牌错误', errorMessage });
        return createErrorResponse('无效的令牌', ERROR_VIDEOS.INVALID_TOKEN);
      }

      // 未知错误
      return {
        code: FieldCode.Error
      };
    }
  }
});

export default basekit;
    