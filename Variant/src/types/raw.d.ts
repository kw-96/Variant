/**
 * 资源文件声明：允许以 ?raw 查询方式把 HTML 作为字符串导入。
 * PSD 转换页通过 iframe srcdoc 内联 psd-ui.html；Vite 原生支持 ?raw，
 * Figma 侧 Webpack 通过 resourceQuery /raw/ 的 asset/source 规则支持。
 */
declare module '*.html?raw' {
  const content: string;
  export default content;
}
