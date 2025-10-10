export function deepMerge(obj1: any, obj2: any): any {
  let key: string;
  for (key in obj2) {
    // 如果target(也就是obj1[key])存在，且是对象的话再去调用deepMerge，否则就是obj1[key]里面没这个对象，需要与obj2[key]合并
    // 如果obj2[key]没有值或者值不是对象，此时直接替换obj1[key]
    obj1[key] =
      obj1[key] &&
      obj1[key].toString() === '[object Object]' &&
      obj2[key] &&
      obj2[key].toString() === '[object Object]'
        ? deepMerge(obj1[key], obj2[key])
        : (obj1[key] = obj2[key]);
  }
  return obj1;
}

export const color16ToRgb = (str: string) => {
  var reg = /^#([0-9A-Fa-f]{3}|[0-9A-Fa-f]{6})$/;
  if (!reg.test(str)) {
    return;
  }
  let newStr = str.toLowerCase().replace(/\#/g, '');
  let len = newStr.length;
  if (len == 3) {
    let t = '';
    for (var i = 0; i < len; i++) {
      t += newStr.slice(i, i + 1).concat(newStr.slice(i, i + 1));
    }
    newStr = t;
  }
  let arr = []; //将字符串分隔，两个两个的分隔
  for (var i = 0; i < 6; i = i + 2) {
    let s = newStr.slice(i, i + 2);
    arr.push(parseInt('0x' + s));
  }

  return {
    r: Number(arr[0]) / 255,
    g: Number(arr[1]) / 255,
    b: Number(arr[2]) / 255,
    a: 0.8, // MasterGo 要求必须有 alpha 属性
  };
};

export const createObject = (fun: string, option?: any) => {
  const { width, height, ...other } = option || {};
  
  console.log('createObject called with:', fun);
  
  // 根据 MasterGo 官方文档正确调用 API
  let obj;
  try {
    if (fun === 'createRectangle') {
      obj = mg.createRectangle();
    } else if (fun === 'createFrame') {
      // MasterGo 可能没有 createFrame，使用 createRectangle 代替
      obj = mg.createRectangle();
    } else {
      // 其他类型暂时不支持
      throw new Error(`Unsupported object type: ${fun}`);
    }
  } catch (error) {
    console.error('Error creating object:', error);
    throw error;
  }

  // 设置尺寸
  if (width && height) {
    obj.width = width;
    obj.height = height;
  }

  // 设置其他属性
  if (other) {
    Object.assign(obj, other);
  }

  console.log('Created object:', obj);
  return obj;
};

export const cloneNode = (node: any, option?: any) => {
  const { width, height, ...other } = option || {};
  const clone = node.clone();

  if (width && height) {
    clone.width = width;
    clone.height = height;
  }

  if (other) {
    Object.assign(clone, other);
  }

  return clone;
};

export const createImageFrame = async (node: any) => {
  const bytes = await node.exportAsync({
    format: 'PNG',
    constraint: { type: 'SCALE', value: 1 },
  });
  const image = mg.createImage(bytes);
  const imageFrame = createObject('createFrame', {
    x: node.x,
    y: node.y,
    width: node.width,
    height: node.height,
    fills: [
      {
        imageHash: (image as any).hash,
        scaleMode: 'CROP',
        type: 'IMAGE',
      },
    ],
  });

  // canvas频繁调用getImageData会导致渲染空白，且mastergo未提供接口支持，所以这里使用setTimeout延迟
  await new Promise(resolve => setTimeout(resolve, 150));

  return imageFrame;
};

export async function clearAllClientStorage() {
  const keys = await mg.clientStorage.keysAsync(); // 获取所有存储的键
  for (const key of keys) {
    await mg.clientStorage.deleteAsync(key);
  }

  mg.notify('All client storage cleared!');
}

export const clearPreview = (node: any, key: string) => {
  let hasClear = false;
  
  const currentPage = (mg as any).document?.currentPage;
  if (!currentPage) {
    console.warn('Current page is not available');
    return hasClear;
  }

  currentPage.children.forEach((itemNode: any) => {
    if (itemNode.getPluginData(key) === node.id) {
      itemNode.remove();
      hasClear = true;
    }
  });

  return hasClear;
};
