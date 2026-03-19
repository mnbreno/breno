const path = require("path");
const CopyWebpackPlugin = require("copy-webpack-plugin");

module.exports = (_, argv = {}) => {
  const mode = argv.mode || "development";
  const isProduction = mode === "production";

  return {
    mode,
    devtool: isProduction ? "source-map" : "inline-source-map",
    entry: {
      background: "./src/background/index.ts",
      content: "./src/content/index.ts",
      popup: "./src/popup/popup.ts",
      options: "./src/options/options.ts",
    },
    output: {
      path: path.resolve(__dirname, "dist"),
      filename: "[name].js",
      clean: true,
    },
    resolve: {
      extensions: [".ts", ".js"],
      alias: {
        "@shared": path.resolve(__dirname, "src/shared"),
      },
    },
    module: {
      rules: [
        {
          test: /\.ts$/,
          use: "ts-loader",
          exclude: /node_modules/,
        },
      ],
    },
    plugins: [
      new CopyWebpackPlugin({
        patterns: [
          { from: "manifest.json", to: "manifest.json" },
          { from: "src/popup/popup.html", to: "popup.html" },
          { from: "src/popup/popup.css", to: "popup.css" },
          { from: "src/options/options.html", to: "options.html" },
          { from: "assets", to: "assets" },
        ],
      }),
    ],
    stats: "minimal",
  };
};
