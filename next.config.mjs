import withPWA from "next-pwa";

const isDev = process.env.NODE_ENV !== "production";

const baseConfig = {
  reactStrictMode: true
};

export default withPWA({
  dest: "public",
  disable: isDev
})(baseConfig);
