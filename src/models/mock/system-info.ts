import { JavaInfo } from "@/models/system-info";

export const mockJavaInfo: JavaInfo[] = [
  {
    name: "JDK 17.0.12.7",
    fileDir: "/mock/path/to/java//Microsoft/jdk-17.0.12.7-hotspot/java.exe",
    architecture: "x86-64",
    vendor: "Microsoft",
    version: "Java 17 (LTS)",
  },
  {
    name: "JRE 1.8.0_51",
    fileDir: "/mock/path/to/java/Oracle/jre1.8.0_51/java.exe",
    architecture: "x86-64",
    vendor: "Oracle",
    version: "Java 8",
  },
];
