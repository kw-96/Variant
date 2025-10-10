export function deepMerge(obj1, obj2) {
  let key;
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

export const color16ToRgb = str => {
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
  let arr: number[] = []; //将字符串分隔，两个两个的分隔
  for (var i = 0; i < 6; i = i + 2) {
    let s = newStr.slice(i, i + 2);
    arr.push(parseInt('0x' + s));
  }

  return {
    r: Number(arr[0]) / 255,
    g: Number(arr[1]) / 255,
    b: Number(arr[2]) / 255,
  };
};

export const createObject = (fun, option?) => {
  const { width, height, ...other } = option || {};
  const obj = figma[fun]();

  if (width && height) {
    obj.resize(width, height);
  }

  if (other) {
    Object.assign(obj, other);
  }

  return obj;
};

export const cloneNode = (node, option?) => {
  const { width, height, ...other } = option || {};
  const clone = node.clone();

  if (width && height) {
    clone.resize(width, height);
  }

  if (other) {
    Object.assign(clone, other);
  }

  return clone;
};

export const createImageFrame = async node => {
  const bytes = await node.exportAsync({
    format: 'PNG',
    constraint: { type: 'SCALE', value: 1 },
  });
  const image = figma.createImage(bytes);
  const imageFrame = createObject('createFrame', {
    x: node.x,
    y: node.y,
    width: node.width,
    height: node.height,
    fills: [
      {
        imageHash: image.hash,
        scaleMode: 'CROP',
        type: 'IMAGE',
      },
    ],
  });

  // canvas频繁调用getImageData会导致渲染空白，且figma未提供接口支持，所以这里使用setTimeout延迟
  await new Promise(resolve => setTimeout(resolve, 150));

  return imageFrame;
};

export async function clearAllClientStorage() {
  const keys = await figma.clientStorage.keysAsync(); // 获取所有存储的键
  for (const key of keys) {
    await figma.clientStorage.deleteAsync(key);
  }

  figma.notify('All client storage cleared!');
}

export const clearPreview = (node, key) => {
  let hasClear = false;

  figma.currentPage.children.forEach(itemNode => {
    if (itemNode.getPluginData(key) === node.id) {
      itemNode.remove();
      hasClear = true;
    }
  });

  return hasClear;
};
