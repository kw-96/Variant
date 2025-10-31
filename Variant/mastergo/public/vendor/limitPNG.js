/*
  本文件用于在构建后由 UI 通过 ./vendor/limitPNG.js 动态加载，
  需被替换为真实的 limitPNG 实现。

  约定暴露：window.limitPNG.compressToTarget(u8a: Uint8Array, targetK: number) => Promise<Uint8Array>
  当前占位实现仅直接返回输入数据，便于流程跑通。
*/
(function(){
  if (typeof window === 'undefined') return;
  if (!window.limitPNG) window.limitPNG = {};

  // 将 Uint8Array 转为可加载图片的 URL
  function u8aToUrl(u8a){
    var blob = new Blob([u8a], { type: 'image/png' });
    return URL.createObjectURL(blob);
  }

  function loadImage(url){
    return new Promise(function(resolve,reject){
      var img = new Image();
      img.onload = function(){ resolve(img); };
      img.onerror = reject;
      img.src = url;
    });
  }

  function canvasToBlob(canvas){
    return new Promise(function(resolve,reject){
      canvas.toBlob(function(b){ if(b) resolve(b); else reject(new Error('toBlob fail')); }, 'image/png');
    });
  }

  // 无损重压缩（通过 Canvas 重新编码 PNG），可带来少量体积优化
  function losslessOptimize(u8a){
    var url = u8aToUrl(u8a);
    return loadImage(url).then(function(img){
      var cv = document.createElement('canvas');
      cv.width = img.width; cv.height = img.height;
      var ctx = cv.getContext('2d');
      ctx.drawImage(img, 0, 0);
      return canvasToBlob(cv).then(function(blob){
        return blob.arrayBuffer().then(function(ab){
          var arr = new Uint8Array(ab);
          return { u8a: arr, sizeK: Math.floor(arr.length/1000) };
        });
      });
    }).finally(function(){ URL.revokeObjectURL(url); });
  }

  // 简易色彩量化（通道分级+可选抖动），并以 PNG 导出
  function quantizeToCanvas(img, steps, useDither){
    var w = img.width, h = img.height;
    var cv = document.createElement('canvas');
    cv.width = w; cv.height = h;
    var ctx = cv.getContext('2d');
    ctx.drawImage(img, 0, 0);
    var imgd = ctx.getImageData(0,0,w,h);
    var d = imgd.data;

    var stepSize = Math.max(1, Math.floor(256 / steps)); // 每通道步长
    function q(v){ return Math.min(255, Math.floor(v / stepSize) * stepSize); }

    if (!useDither){
      for (var i=0;i<d.length;i+=4){
        d[i] = q(d[i]);
        d[i+1] = q(d[i+1]);
        d[i+2] = q(d[i+2]);
      }
      ctx.putImageData(imgd,0,0);
      return cv;
    }

    // Floyd–Steinberg 抖动（简化实现）
    for (var y=0;y<h;y++){
      for (var x=0;x<w;x++){
        var idx = (y*w + x)*4;
        var r = d[idx], g = d[idx+1], b = d[idx+2];
        var nr = q(r), ng = q(g), nb = q(b);
        d[idx] = nr; d[idx+1] = ng; d[idx+2] = nb;
        var er = r - nr, eg = g - ng, eb = b - nb;

        function spread(ix,iy,fr){
          if(ix<0||ix>=w||iy<0||iy>=h) return;
          var id2 = (iy*w + ix)*4;
          d[id2]   = Math.max(0, Math.min(255, d[id2]   + er*fr));
          d[id2+1] = Math.max(0, Math.min(255, d[id2+1] + eg*fr));
          d[id2+2] = Math.max(0, Math.min(255, d[id2+2] + eb*fr));
        }
        spread(x+1,y,   7/16);
        spread(x-1,y+1, 3/16);
        spread(x,  y+1, 5/16);
        spread(x+1,y+1, 1/16);
      }
    }
    ctx.putImageData(imgd,0,0);
    return cv;
  }

  function posterizeToTarget(u8a, targetK){
    var url = u8aToUrl(u8a);
    return loadImage(url).then(function(img){
      var low = 4, high = 64; // 每通道分级数搜索范围
      var best = { u8a: u8a, sizeK: Math.floor(u8a.length/1000), steps: 256 };
      var promise = Promise.resolve();
      for (var i=0;i<6;i++){
        (function(){
          var steps = Math.max(2, Math.floor((low+high)/2));
          promise = promise.then(function(){
            var cv = quantizeToCanvas(img, steps, true);
            return canvasToBlob(cv).then(function(blob){
              return blob.arrayBuffer().then(function(ab){
                var arr = new Uint8Array(ab);
                var sizeK = Math.floor(arr.length/1000);
                if (sizeK <= targetK){
                  best = { u8a: arr, sizeK: sizeK, steps: steps };
                  high = steps;
                } else {
                  low = steps + 1;
                  if (sizeK < best.sizeK) best = { u8a: arr, sizeK: sizeK, steps: steps };
                }
              });
            });
          });
        })();
      }
      return promise.then(function(){ return best; });
    }).finally(function(){ URL.revokeObjectURL(url); });
  }

  window.limitPNG.compressToTarget = function(u8a, targetK){
    targetK = targetK|0;
    return losslessOptimize(u8a).then(function(lossless){
      var base = lossless.u8a.length < u8a.length ? lossless.u8a : u8a;
      var baseK = Math.floor(base.length/1000);
      if (targetK > 0 && baseK <= targetK) return base;
      if (targetK <= 0) return base;
      return posterizeToTarget(base, targetK).then(function(lossy){ return lossy.u8a; });
    });
  };
})();


