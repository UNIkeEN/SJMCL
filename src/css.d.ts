declare module "*.module.css" {
  const classes: { readonly [key: string]: string };
  export default classes;
}

declare module "*.css";

declare module "@/styles/globals.css";

declare module "react-virtualized/styles.css";
