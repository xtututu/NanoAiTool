import { basekit, FieldType, field, FieldComponent, FieldCode, AuthorizationType } from '@lark-opdev/block-basekit-server-api';
import { BodyInit } from 'node-fetch'; // 导入BodyInit类型
const { t } = field;
const https = require("https");
const FormData = require("form-data");

const feishuDm = ['feishu.cn', 'feishucdn.com', 'larksuitecdn.com', 'larksuite.com','api.chatfire.cn','api.xunkecloud.cn', 'token.yishangcloud.cn'];
basekit.addDomainList([...feishuDm, 'api.exchangerate-api.com']);

basekit.addField({
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
      defaultValue: { label: 'nano-banana', value: 'nano-banana'},
      props: {
        options: [
           { label: 'nano-banana', value: 'nano-banana'},
           { label: 'nano-banana-pro', value: 'nano-banana-pro'},
           { label: 'nano-banana-pro_4k', value: 'nano-banana-pro_4k'},

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

    try {

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
      
      
      let chatfireNanoUrl = initialResult.data[0].url;
      
      
      if (!chatfireNanoUrl) {
        throw new Error('未获取到图片URL');
      }
      
      // 调用上传接口
      
        const uploadUrl = 'http://token.yishangcloud.cn/api/image/upload';
        const uploadOptions = {
          method: 'POST',
          headers: {'Content-Type': 'application/json'},
          body: JSON.stringify({
            image_url: chatfireNanoUrl
          })
        };
        
        debugLog({'=2 调用上传接口': {uploadUrl, chatfireNanoUrl}});
        let uploadResp = await context.fetch(uploadUrl, uploadOptions, 'auth_id_1');

        const uploadResult = await uploadResp.json();
        
       

      let imageUrl = "http://token.yishangcloud.cn"+uploadResult.image_url;

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

    } catch (e) {
      console.log('====error', String(e));
      debugLog({ '===999 异常错误': String(e) });

       if (String(e).includes('无可用渠道')) {
        
        return {
          code: FieldCode.Success, // 0 表示请求成功
          // data 类型需与下方 resultType 定义一致
          data:[{
              name:  "捷径异常"+'.png',
              content: "https://pay.xunkecloud.cn/image/unusual.png",
              contentType: "attachment/url"
            }] 
        };
      }
      // 检查错误消息中是否包含余额耗尽的信息
      if (String(e).includes('令牌额度已用尽')) {
        return {
          code: FieldCode.Success, // 0 表示请求成功
          // data 类型需与下方 resultType 定义一致
          data:[{
              name:  "余额耗尽"+'.png',
              content: "https://pay.xunkecloud.cn/image/Insufficient.png",
              contentType: "attachment/url"
            }] 
        };
      }
       if (String(e).includes('无效的令牌')) {
        
        return {
        code: FieldCode.Success, // 0 表示请求成功
        data: [
          {
            "name": "无效的令牌"+'.png', // 附件名称,需要带有文件格式后缀
            "content": "https://pay.xunkecloud.cn/image/tokenError.png", // 可通过http.Get 请求直接下载的url.
            "contentType": "attachment/url", // 固定值
          }
        ],
        }
      }

      return { code: FieldCode.Error };
    }
  }
});

export default basekit;
    