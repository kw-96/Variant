const HtmlWebpackPlugin = require('html-webpack-plugin');
const InlineChunkHtmlPlugin = require('react-dev-utils/InlineChunkHtmlPlugin');
const { VueLoaderPlugin } = require('vue-loader');
const { VantResolver } = require('@vant/auto-import-resolver');
const AutoImport = require('unplugin-auto-import/webpack');
const Components = require('unplugin-vue-components/webpack');
const path = require('path');

const cssModuleLoader = {
  loader: 'css-loader',
  options: {
    // 开启 CSS Modules
    // @see https://github.com/css-modules/css-modules
    modules: {
      localIdentName: '[local]_[hash:base64:5]',
    },
  },
};

function genModuleLoaderOneOf(loaders) {
  return [
    {
      resourceQuery: /module/,
      use: loaders.map(loader => {
        if (loader === 'css-loader') {
          return cssModuleLoader;
        }

        return loader;
      }),
    },
    {
      use: loaders,
    },
  ];
}

const commonConfig = (env, argv) => ({
  mode: argv.mode === 'production' ? 'production' : 'development',

  // This is necessary because Figma's 'eval' works differently than normal eval
  devtool: argv.mode === 'production' ? false : 'inline-source-map',

  output: {
    filename: '[name].js',
    path: path.resolve(__dirname, 'dist'), // Compile into a folder called "dist"
  },

  // Webpack tries these extensions for you if you omit the extension like "import './file'"
  resolve: {
    alias: {
      '@': path.resolve(__dirname, '../src'),
      '@messages': path.resolve(__dirname, '../src/messages'),
    },
    extensions: ['.tsx', '.ts', '.jsx', '.js', '.mjs'],
  },
});

const codeConfig = (env, argv) =>
  Object.assign(commonConfig(env, argv), {
    entry: {
      code: './src/plugin/index.ts', // The entry point for your plugin code
    },

    module: {
      rules: [
        {
          test: /\.ts$/, // 匹配.ts文件
          use: {
            loader: 'babel-loader',
            options: {
              presets: [
                [
                  '@babel/preset-typescript',
                  {
                    allExtensions: true, //支持所有文件扩展名(重要)
                  },
                ],
                ['@babel/preset-env'],
              ],
            },
          },
        },
      ],
    },
  });

const uiConfig = (env, argv) =>
  Object.assign(commonConfig(env, argv), {
    entry: {
      ui: '../src/ui/ui.ts', // The entry point for your UI code
    },

    module: {
      rules: [
        {
          test: /\.vue$/, // 匹配.vue文件
          use: 'vue-loader', // 用vue-loader去解析vue文件
        },

        {
          test: /\.ts$/, // 匹配.ts文件
          use: {
            loader: 'babel-loader',
            options: {
              presets: [
                [
                  '@babel/preset-typescript',
                  {
                    allExtensions: true, //支持所有文件扩展名(重要)
                  },
                ],
              ],
            },
          },
        },

        // Enables including CSS by doing "import './file.css'" in your TypeScript code
        {
          test: /\.css$/,
          oneOf: genModuleLoaderOneOf(['style-loader', 'css-loader']),
        },

        {
          test: /\.less$/,
          oneOf: genModuleLoaderOneOf([
            'style-loader',
            'css-loader',
            'less-loader',
          ]),
        },

        // Allows you to use "<%= require('./file.svg') %>" in your HTML code to get a data URI
        { test: /\.(png|jpg|gif|webp|svg)$/, loader: 'url-loader' },
      ],
    },

    // Tells Webpack to generate "ui.html" and to inline "ui.ts" into it
    plugins: [
      new HtmlWebpackPlugin({
        template: '../src/ui/ui.html',
        filename: 'ui.html',
        chunks: ['ui'],
        cache: false,
      }),
      new InlineChunkHtmlPlugin(HtmlWebpackPlugin, [/ui/]),
      new VueLoaderPlugin(),
      AutoImport({
        resolvers: [VantResolver()],
      }),
      Components({ resolvers: [VantResolver()] }),
    ],
  });

module.exports = [codeConfig, uiConfig];
