import { basekit, FieldType, field, FieldComponent, FieldCode, AuthorizationType } from '@lark-opdev/block-basekit-server-api';
import { BodyInit } from 'node-fetch'; // 导入BodyInit类型
const { t } = field;
const https = require("https");
const FormData = require("form-data");

const feishuDm = ['feishu.cn', 'feishucdn.com', 'larksuitecdn.com', 'larksuite.com','api.chatfire.cn','api.xunkecloud.cn'];
basekit.addDomainList([...feishuDm, 'api.exchangerate-api.com']);

basekit.addField({
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
      key: 'imageMethod',
      label: t('imageMethod'),
      component: FieldComponent.Radio,
      defaultValue: { label: t('metLabelOne'), value: 'textToImage'},
      props: {
        options: [
          { label: t('metLabelOne'), value: 'textToImage'},
          { label: t('metLabelTwo'), value: 'imageToImage'},
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
    const { imageMethod, imagePrompt, refImage } = formItemParams;
    let englishPrompt = imagePrompt;

    function debugLog(arg: any) {
      console.log(JSON.stringify({
        timestamp: new Date().toISOString(),
        ...arg
      }));
    }

    try {
      console.log("==================");
      
      // 参数校验
      if (((imageMethod.value === 'imageToImage' ) && !refImage)) {
        debugLog({ type: 'error', message: "请上传参考图片", code: 400 });
        return {
          code: FieldCode.Success,
          data: { id: `错误: 请上传参考图片` },
          msg: "请上传参考图片"
        };
      }

      if ((imageMethod.value === 'textToImage' && refImage)) {
        debugLog({ type: 'error', message: "文生图片请不要上传参考图片", code: 400 });
        return {
          code: FieldCode.Success,
          data: { id: `错误: 文生图片请不要上传参考图片` },
          msg: "文生图片请不要上传参考图片"
        };
      }

      const createImageUrl = imageMethod.value === 'textToImage' 
        ? `http://api.xunkecloud.cn/v1/images/generations` 
        : `http://api.xunkecloud.cn/v1/images/edits`;
      
      console.log("createImageUrl:", createImageUrl);

      // 远程图片转Buffer工具函数
      async function remoteUrlToBuffer(imageUrl: string): Promise<Buffer> {
        return new Promise((resolve, reject) => {
          const request = https.get(imageUrl, (response) => {
          response.setTimeout(30000);
            if (response.statusCode !== 200) {
              reject(new Error(`获取图片失败：状态码 ${response.statusCode}`));
              response.resume();
              return;
            }

            const chunks: Buffer[] = [];
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
          body: formData as unknown as BodyInit,
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
          headers: {'Content-Type': 'application/json'},
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

      debugLog({'=1 图片创建接口结果': taskResp});
      
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
      return { code: FieldCode.Error };
    }
  }
});

export default basekit;
    