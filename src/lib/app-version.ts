import packageJson from "../../package.json";

/**
 * The app's version, from package.json, shown beside the logo and sent with feedback. Raised with each release worth
 * telling users about; below 1.0 the app is in beta.
 */
export const APP_VERSION = packageJson.version;

/** The version as shown: "v0.9" (patch releases aren't worth the space). */
export const APP_VERSION_SHORT = `v${APP_VERSION.split(".").slice(0, 2).join(".")}`;
