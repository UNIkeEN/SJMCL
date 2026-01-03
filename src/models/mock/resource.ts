import { OtherResourceSource, OtherResourceType } from "@/enums/resource";
import { OtherResourceInfo } from "@/models/resource";

// from https://bmclapi2.bangbang93.com/forge/minecraft/1.21
export const mockForgeVersions: any[] = [
  {
    _id: "666c858d8dd411d8f8f3832d",
    __v: 0,
    build: 51000008,
    files: [
      {
        format: "txt",
        category: "changelog",
        hash: "930c3c167e4a3ec944adadc3065ccac62c91d438",
      },
      {
        format: "jar",
        category: "installer",
        hash: "4e4fa11f5e04fd968bc6ee1021f312ad4b233170",
      },
      {
        format: "zip",
        category: "mdk",
        hash: "7a57d0a2c817486edd614fe8748445ed8f48cd33",
      },
    ],
    mcversion: "1.21",
    modified: "2024-06-14T16:58:53.000Z",
    version: "51.0.8",
  },
  {
    _id: "666c858f8dd411d8f8f3848f",
    __v: 0,
    build: 51000007,
    files: [
      {
        format: "txt",
        category: "changelog",
        hash: "c7b1d0e7c930e45a91fd7a81e3887dbe67acf0bf",
      },
      {
        format: "jar",
        category: "installer",
        hash: "a126fb8a0b2d8ffa533c01eb7a1c42303c298005",
      },
      {
        format: "zip",
        category: "mdk",
        hash: "c707999a2c1e32f17ee3d5b89af67de4b14db103",
      },
    ],
    mcversion: "1.21",
    modified: "2024-06-14T16:12:10.000Z",
    version: "51.0.7",
  },
  {
    _id: "666c85928dd411d8f8f38594",
    __v: 0,
    build: 51000006,
    files: [
      {
        format: "txt",
        category: "changelog",
        hash: "37ac429569757720ab3ef600b64482613a10a4ca",
      },
      {
        format: "jar",
        category: "installer",
        hash: "1d50b5581838d23b76e4b8c9a19ba283b4fb8d61",
      },
      {
        format: "zip",
        category: "mdk",
        hash: "bd68c8737b55dfc7478ebab64414593d4564ebf4",
      },
    ],
    mcversion: "1.21",
    modified: "2024-06-14T15:46:43.000Z",
    version: "51.0.6",
  },
  {
    _id: "666c85948dd411d8f8f38689",
    __v: 0,
    build: 51000005,
    files: [
      {
        format: "txt",
        category: "changelog",
        hash: "0b6869327e8770b0c467472ad4e467884574e62c",
      },
      {
        format: "jar",
        category: "installer",
        hash: "029b7bb65e58c1b6d1a2b3e3f0831ce847c32671",
      },
      {
        format: "zip",
        category: "mdk",
        hash: "e7e054b5a7534c6470971c016205ad5c7d65b3a5",
      },
    ],
    mcversion: "1.21",
    modified: "2024-06-14T00:30:59.000Z",
    version: "51.0.5",
  },
  {
    _id: "666c85968dd411d8f8f3870e",
    __v: 0,
    build: 51000004,
    files: [
      {
        format: "txt",
        category: "changelog",
        hash: "fdc25d53e30dd5ad270338449c8dfc3c659fc6fb",
      },
      {
        format: "jar",
        category: "installer",
        hash: "b977905b06628d6f3c31a0f48c7f2ec0d0987d91",
      },
      {
        format: "zip",
        category: "mdk",
        hash: "cb6a76a20232bca288ce70ae34c4d1a642983a08",
      },
    ],
    mcversion: "1.21",
    modified: "2024-06-13T22:26:24.000Z",
    version: "51.0.4",
  },
];

// from https://bmclapi2.bangbang93.com/fabric-meta/v2/versions/loader/1.21
export const mockFabricVersions: any[] = [
  {
    loader: {
      separator: ".",
      build: 10,
      maven: "net.fabricmc:fabric-loader:0.16.10",
      version: "0.16.10",
      stable: true,
    },
    intermediary: {
      maven: "net.fabricmc:intermediary:1.21",
      version: "1.21",
      stable: true,
    },
    launcherMeta: {
      version: 2,
      min_java_version: 8,
      libraries: {
        client: [],
        common: [
          {
            name: "org.ow2.asm:asm:9.7.1",
            url: "https://maven.fabricmc.net/",
            md5: "e2cdd32d198ad31427d298eee9d39d8d",
            sha1: "f0ed132a49244b042cd0e15702ab9f2ce3cc8436",
            sha256:
              "8cadd43ac5eb6d09de05faecca38b917a040bb9139c7edeb4cc81c740b713281",
            sha512:
              "4767b01603dad5c79cc1e2b5f3722f72b1059d928f184f446ba11badeb1b381b3a3a9a801cc43d25d396df950b09d19597c73173c411b1da890de808b94f1f50",
            size: 126093,
          },
          {
            name: "org.ow2.asm:asm-analysis:9.7.1",
            url: "https://maven.fabricmc.net/",
            md5: "4cd9e7178dfb85371bba3077e40cd514",
            sha1: "f97a3b319f0ed6a8cd944dc79060d3912a28985f",
            sha256:
              "85b29371884ba31bb76edf22323c2c24e172c3267a67152eba3d1ccc2e041ef2",
            sha512:
              "a8bd265c81d9bb4371cafd3f5d18f96ad79aec65031457d518c54599144d199d9feddf13b8dc822b2598b8b504a88edbd81d1f2c52991a70a6b343d8f5bb6fe5",
            size: 35126,
          },
          {
            name: "org.ow2.asm:asm-commons:9.7.1",
            url: "https://maven.fabricmc.net/",
            md5: "8344aea3c8b7d707e9d35a62710e77c9",
            sha1: "406c6a2225cfe1819f102a161e54cc16a5c24f75",
            sha256:
              "9a579b54d292ad9be171d4313fd4739c635592c2b5ac3a459bbd1049cddec6a0",
            sha512:
              "81daf5765e387e6aeec5d45c4b9e4e1b471fb4f350931e5a214845c7c657a2142768f6902765e49c0ce2c595962e5d008883cba2e4a40c4bdce8f2e92518d2db",
            size: 73459,
          },
          {
            name: "org.ow2.asm:asm-tree:9.7.1",
            url: "https://maven.fabricmc.net/",
            md5: "e85029f613b6469989cc7cf53fe06b74",
            sha1: "3a53139787663b139de76b627fca0084ab60d32c",
            sha256:
              "9929881f59eb6b840e86d54570c77b59ce721d104e6dfd7a40978991c2d3b41f",
            sha512:
              "e55008c392fdd35e95d3404766b12dd4b46e13d5c362fcd0ab42a65751a82737eaf0ebc857691d1916190d34407adfde4437615d69c278785416fd911e00978d",
            size: 51939,
          },
          {
            name: "org.ow2.asm:asm-util:9.7.1",
            url: "https://maven.fabricmc.net/",
            md5: "36d373a9cd6cad9b35db9f984c6b4bbb",
            sha1: "9e23359b598ec6b74b23e53110dd5c577adf2243",
            sha256:
              "f885be71b5c90556f5f1ad1c4f9276b29b96057c497d46666fe4ddbec3cb43c6",
            sha512:
              "522d793d15a2c5ea6504a50222cf0750f1eab7b881cf289675042539b1aba8b3868197b1bebe729de728dd10020eb028ae16252dcd5d84fdcbf7f925832bc269",
            size: 94519,
          },
          {
            name: "net.fabricmc:sponge-mixin:0.15.4+mixin.0.8.7",
            url: "https://maven.fabricmc.net/",
            md5: "991ca8be2c408fe19eb64014d8a18243",
            sha1: "6a12aacc794f1078458433116e9ed42c1cc98096",
            sha256:
              "4631f67da980ae2ac9e6e285a7df4680645e2f37a6a14acc775f97982162c2a2",
            sha512:
              "d4f6caaee7cb841cc9bc36ae5eb725bdb3dd28a5af8f63f75747a17156d708263b37f5a87eca863b2c3d91732c0b128318e9de455d1cd964e1ae8ba0a318fbf1",
            size: 1494834,
          },
        ],
        server: [],
        development: [
          {
            name: "io.github.llamalad7:mixinextras-fabric:0.4.1",
            url: "https://maven.fabricmc.net/",
            md5: "e447f76602559932e9b3e790f27da065",
            sha1: "8d1a9e96afb990367fa1f904d17580d164da72e3",
            sha256:
              "bb7042dd915cad67dc7c2ad0a4c0eabe6e097123785d7877beded6e0700f92ef",
            sha512:
              "424a8c33f37159d5987c6bba56ffb5704c70763a157cb2de7a6962c0021d8829cc3850ce474ceae86acf26921b2ec811a48577aed2f18c96902a30205103ae3c",
            size: 202066,
          },
        ],
      },
      mainClass: {
        client: "net.fabricmc.loader.impl.launch.knot.KnotClient",
        server: "net.fabricmc.loader.impl.launch.knot.KnotServer",
      },
    },
  },
  {
    loader: {
      separator: ".",
      build: 9,
      maven: "net.fabricmc:fabric-loader:0.16.9",
      version: "0.16.9",
      stable: false,
    },
    intermediary: {
      maven: "net.fabricmc:intermediary:1.21",
      version: "1.21",
      stable: true,
    },
    launcherMeta: {
      version: 2,
      min_java_version: 8,
      libraries: {
        client: [],
        common: [
          {
            name: "org.ow2.asm:asm:9.7.1",
            url: "https://maven.fabricmc.net/",
            md5: "e2cdd32d198ad31427d298eee9d39d8d",
            sha1: "f0ed132a49244b042cd0e15702ab9f2ce3cc8436",
            sha256:
              "8cadd43ac5eb6d09de05faecca38b917a040bb9139c7edeb4cc81c740b713281",
            sha512:
              "4767b01603dad5c79cc1e2b5f3722f72b1059d928f184f446ba11badeb1b381b3a3a9a801cc43d25d396df950b09d19597c73173c411b1da890de808b94f1f50",
            size: 126093,
          },
          {
            name: "org.ow2.asm:asm-analysis:9.7.1",
            url: "https://maven.fabricmc.net/",
            md5: "4cd9e7178dfb85371bba3077e40cd514",
            sha1: "f97a3b319f0ed6a8cd944dc79060d3912a28985f",
            sha256:
              "85b29371884ba31bb76edf22323c2c24e172c3267a67152eba3d1ccc2e041ef2",
            sha512:
              "a8bd265c81d9bb4371cafd3f5d18f96ad79aec65031457d518c54599144d199d9feddf13b8dc822b2598b8b504a88edbd81d1f2c52991a70a6b343d8f5bb6fe5",
            size: 35126,
          },
          {
            name: "org.ow2.asm:asm-commons:9.7.1",
            url: "https://maven.fabricmc.net/",
            md5: "8344aea3c8b7d707e9d35a62710e77c9",
            sha1: "406c6a2225cfe1819f102a161e54cc16a5c24f75",
            sha256:
              "9a579b54d292ad9be171d4313fd4739c635592c2b5ac3a459bbd1049cddec6a0",
            sha512:
              "81daf5765e387e6aeec5d45c4b9e4e1b471fb4f350931e5a214845c7c657a2142768f6902765e49c0ce2c595962e5d008883cba2e4a40c4bdce8f2e92518d2db",
            size: 73459,
          },
          {
            name: "org.ow2.asm:asm-tree:9.7.1",
            url: "https://maven.fabricmc.net/",
            md5: "e85029f613b6469989cc7cf53fe06b74",
            sha1: "3a53139787663b139de76b627fca0084ab60d32c",
            sha256:
              "9929881f59eb6b840e86d54570c77b59ce721d104e6dfd7a40978991c2d3b41f",
            sha512:
              "e55008c392fdd35e95d3404766b12dd4b46e13d5c362fcd0ab42a65751a82737eaf0ebc857691d1916190d34407adfde4437615d69c278785416fd911e00978d",
            size: 51939,
          },
          {
            name: "org.ow2.asm:asm-util:9.7.1",
            url: "https://maven.fabricmc.net/",
            md5: "36d373a9cd6cad9b35db9f984c6b4bbb",
            sha1: "9e23359b598ec6b74b23e53110dd5c577adf2243",
            sha256:
              "f885be71b5c90556f5f1ad1c4f9276b29b96057c497d46666fe4ddbec3cb43c6",
            sha512:
              "522d793d15a2c5ea6504a50222cf0750f1eab7b881cf289675042539b1aba8b3868197b1bebe729de728dd10020eb028ae16252dcd5d84fdcbf7f925832bc269",
            size: 94519,
          },
          {
            name: "net.fabricmc:sponge-mixin:0.15.4+mixin.0.8.7",
            url: "https://maven.fabricmc.net/",
            md5: "991ca8be2c408fe19eb64014d8a18243",
            sha1: "6a12aacc794f1078458433116e9ed42c1cc98096",
            sha256:
              "4631f67da980ae2ac9e6e285a7df4680645e2f37a6a14acc775f97982162c2a2",
            sha512:
              "d4f6caaee7cb841cc9bc36ae5eb725bdb3dd28a5af8f63f75747a17156d708263b37f5a87eca863b2c3d91732c0b128318e9de455d1cd964e1ae8ba0a318fbf1",
            size: 1494834,
          },
        ],
        server: [],
        development: [
          {
            name: "io.github.llamalad7:mixinextras-fabric:0.4.1",
            url: "https://maven.fabricmc.net/",
            md5: "e447f76602559932e9b3e790f27da065",
            sha1: "8d1a9e96afb990367fa1f904d17580d164da72e3",
            sha256:
              "bb7042dd915cad67dc7c2ad0a4c0eabe6e097123785d7877beded6e0700f92ef",
            sha512:
              "424a8c33f37159d5987c6bba56ffb5704c70763a157cb2de7a6962c0021d8829cc3850ce474ceae86acf26921b2ec811a48577aed2f18c96902a30205103ae3c",
            size: 202066,
          },
        ],
      },
      mainClass: {
        client: "net.fabricmc.loader.impl.launch.knot.KnotClient",
        server: "net.fabricmc.loader.impl.launch.knot.KnotServer",
      },
    },
  },
  {
    loader: {
      separator: ".",
      build: 8,
      maven: "net.fabricmc:fabric-loader:0.16.8",
      version: "0.16.8",
      stable: false,
    },
    intermediary: {
      maven: "net.fabricmc:intermediary:1.21",
      version: "1.21",
      stable: true,
    },
    launcherMeta: {
      version: 2,
      min_java_version: 8,
      libraries: {
        client: [],
        common: [
          {
            name: "org.ow2.asm:asm:9.7.1",
            url: "https://maven.fabricmc.net/",
            md5: "e2cdd32d198ad31427d298eee9d39d8d",
            sha1: "f0ed132a49244b042cd0e15702ab9f2ce3cc8436",
            sha256:
              "8cadd43ac5eb6d09de05faecca38b917a040bb9139c7edeb4cc81c740b713281",
            sha512:
              "4767b01603dad5c79cc1e2b5f3722f72b1059d928f184f446ba11badeb1b381b3a3a9a801cc43d25d396df950b09d19597c73173c411b1da890de808b94f1f50",
            size: 126093,
          },
          {
            name: "org.ow2.asm:asm-analysis:9.7.1",
            url: "https://maven.fabricmc.net/",
            md5: "4cd9e7178dfb85371bba3077e40cd514",
            sha1: "f97a3b319f0ed6a8cd944dc79060d3912a28985f",
            sha256:
              "85b29371884ba31bb76edf22323c2c24e172c3267a67152eba3d1ccc2e041ef2",
            sha512:
              "a8bd265c81d9bb4371cafd3f5d18f96ad79aec65031457d518c54599144d199d9feddf13b8dc822b2598b8b504a88edbd81d1f2c52991a70a6b343d8f5bb6fe5",
            size: 35126,
          },
          {
            name: "org.ow2.asm:asm-commons:9.7.1",
            url: "https://maven.fabricmc.net/",
            md5: "8344aea3c8b7d707e9d35a62710e77c9",
            sha1: "406c6a2225cfe1819f102a161e54cc16a5c24f75",
            sha256:
              "9a579b54d292ad9be171d4313fd4739c635592c2b5ac3a459bbd1049cddec6a0",
            sha512:
              "81daf5765e387e6aeec5d45c4b9e4e1b471fb4f350931e5a214845c7c657a2142768f6902765e49c0ce2c595962e5d008883cba2e4a40c4bdce8f2e92518d2db",
            size: 73459,
          },
          {
            name: "org.ow2.asm:asm-tree:9.7.1",
            url: "https://maven.fabricmc.net/",
            md5: "e85029f613b6469989cc7cf53fe06b74",
            sha1: "3a53139787663b139de76b627fca0084ab60d32c",
            sha256:
              "9929881f59eb6b840e86d54570c77b59ce721d104e6dfd7a40978991c2d3b41f",
            sha512:
              "e55008c392fdd35e95d3404766b12dd4b46e13d5c362fcd0ab42a65751a82737eaf0ebc857691d1916190d34407adfde4437615d69c278785416fd911e00978d",
            size: 51939,
          },
          {
            name: "org.ow2.asm:asm-util:9.7.1",
            url: "https://maven.fabricmc.net/",
            md5: "36d373a9cd6cad9b35db9f984c6b4bbb",
            sha1: "9e23359b598ec6b74b23e53110dd5c577adf2243",
            sha256:
              "f885be71b5c90556f5f1ad1c4f9276b29b96057c497d46666fe4ddbec3cb43c6",
            sha512:
              "522d793d15a2c5ea6504a50222cf0750f1eab7b881cf289675042539b1aba8b3868197b1bebe729de728dd10020eb028ae16252dcd5d84fdcbf7f925832bc269",
            size: 94519,
          },
          {
            name: "net.fabricmc:sponge-mixin:0.15.4+mixin.0.8.7",
            url: "https://maven.fabricmc.net/",
            md5: "991ca8be2c408fe19eb64014d8a18243",
            sha1: "6a12aacc794f1078458433116e9ed42c1cc98096",
            sha256:
              "4631f67da980ae2ac9e6e285a7df4680645e2f37a6a14acc775f97982162c2a2",
            sha512:
              "d4f6caaee7cb841cc9bc36ae5eb725bdb3dd28a5af8f63f75747a17156d708263b37f5a87eca863b2c3d91732c0b128318e9de455d1cd964e1ae8ba0a318fbf1",
            size: 1494834,
          },
        ],
        server: [],
        development: [
          {
            name: "io.github.llamalad7:mixinextras-fabric:0.4.1",
            url: "https://maven.fabricmc.net/",
            md5: "e447f76602559932e9b3e790f27da065",
            sha1: "8d1a9e96afb990367fa1f904d17580d164da72e3",
            sha256:
              "bb7042dd915cad67dc7c2ad0a4c0eabe6e097123785d7877beded6e0700f92ef",
            sha512:
              "424a8c33f37159d5987c6bba56ffb5704c70763a157cb2de7a6962c0021d8829cc3850ce474ceae86acf26921b2ec811a48577aed2f18c96902a30205103ae3c",
            size: 202066,
          },
        ],
      },
      mainClass: {
        client: "net.fabricmc.loader.impl.launch.knot.KnotClient",
        server: "net.fabricmc.loader.impl.launch.knot.KnotServer",
      },
    },
  },
];

// from https://bmclapi2.bangbang93.com/neoforge/list/1.21
export const mockNeoForgeVersions: any[] = [
  {
    _id: "666c86fc8dd411d8f8f43523",
    rawVersion: "neoforge-21.0.1-beta",
    __v: 0,
    installerPath:
      "/maven/net/neoforged/neoforge/21.0.1-beta/neoforge-21.0.1-beta-installer.jar",
    mcversion: "1.21",
    version: "21.0.1-beta",
  },
  {
    _id: "666c87c88dd411d8f8f47ef5",
    rawVersion: "neoforge-21.0.2-beta",
    __v: 0,
    installerPath:
      "/maven/net/neoforged/neoforge/21.0.2-beta/neoforge-21.0.2-beta-installer.jar",
    mcversion: "1.21",
    version: "21.0.2-beta",
  },
  {
    _id: "666c88038dd411d8f8f4990d",
    rawVersion: "neoforge-21.0.3-beta",
    __v: 0,
    installerPath:
      "/maven/net/neoforged/neoforge/21.0.3-beta/neoforge-21.0.3-beta-installer.jar",
    mcversion: "1.21",
    version: "21.0.3-beta",
  },
  {
    _id: "666c88438dd411d8f8f4b115",
    rawVersion: "neoforge-21.0.4-beta",
    __v: 0,
    installerPath:
      "/maven/net/neoforged/neoforge/21.0.4-beta/neoforge-21.0.4-beta-installer.jar",
    mcversion: "1.21",
    version: "21.0.4-beta",
  },
  {
    _id: "666c887f8dd411d8f8f4c99b",
    rawVersion: "neoforge-21.0.5-beta",
    __v: 0,
    installerPath:
      "/maven/net/neoforged/neoforge/21.0.5-beta/neoforge-21.0.5-beta-installer.jar",
    mcversion: "1.21",
    version: "21.0.5-beta",
  },
];

export const mockDownloadResourceList: OtherResourceInfo[] = [
  {
    type: OtherResourceType.Mod,
    name: "Just Enough Items",
    translatedName: "JEI物品管理器",
    description:
      "An item and recipe viewing mod for Minecraft, built from the ground up for stability and performance.",
    iconSrc:
      "https://media.forgecdn.net/avatars/thumbnails/29/69/64/64/635838945588716414.jpeg",
    tags: ["UI", "QoL"],
    lastUpdated: "2022-02-17T00:00:00Z",
    downloads: 11,
    source: OtherResourceSource.CurseForge,
  },
  {
    type: OtherResourceType.ResourcePack,
    name: "Faithful",
    translatedName: "Faithful 32x32",
    description:
      "Faithful is a resource pack that aims to keep the original Minecraft look while improving the textures.",
    iconSrc: "/images/icons/DefaultPack.webp",
    tags: ["Resource Pack", "Texture Pack"],
    lastUpdated: "2022-02-17T00:00:00Z",
    downloads: 20,
  },
  {
    type: OtherResourceType.Mod,
    name: "Xaero's Minimap",
    translatedName: "Xaero 的小地图",
    description: "Displays the world nearby terrain, players, mobs",
    iconSrc:
      "https://media.forgecdn.net/avatars/thumbnails/92/854/64/64/636258666554688823.png",
    tags: ["Map", "Utility"],
    lastUpdated: "2022-02-17T00:00:00Z",
    downloads: 45,
    source: OtherResourceSource.CurseForge,
  },
  {
    type: OtherResourceType.Mod,
    name: "OptiFine",
    description: "A Minecraft mod that optimizes Minecraft's graphics.",
    iconSrc: "/images/icons/GrassBlock.png",
    tags: ["Graphics", "Optimization"],
    lastUpdated: "2022-02-17T00:00:00Z",
    downloads: 14,
    source: OtherResourceSource.CurseForge,
  },
  {
    type: OtherResourceType.Mod,
    name: "Just Enough Items",
    translatedName: "JEI物品管理器",
    description:
      "An item and recipe viewing mod for Minecraft, built from the ground up for stability and performance.",
    iconSrc:
      "https://media.forgecdn.net/avatars/thumbnails/29/69/64/64/635838945588716414.jpeg",
    tags: ["UI", "QoL"],
    lastUpdated: "2022-02-17T00:00:00Z",
    downloads: 11,
    source: OtherResourceSource.CurseForge,
  },
  {
    type: OtherResourceType.ResourcePack,
    name: "Faithful",
    translatedName: "Faithful 32x32",
    description:
      "Faithful is a resource pack that aims to keep the original Minecraft look while improving the textures.",
    iconSrc: "/images/icons/DefaultPack.webp",
    tags: ["Resource Pack", "Texture Pack"],
    lastUpdated: "2022-02-17T00:00:00Z",
    downloads: 20,
  },
  {
    type: OtherResourceType.Mod,
    name: "Xaero's Minimap",
    translatedName: "Xaero 的小地图",
    description: "Displays the world nearby terrain, players, mobs",
    iconSrc:
      "https://media.forgecdn.net/avatars/thumbnails/92/854/64/64/636258666554688823.png",
    tags: ["Map", "Utility"],
    lastUpdated: "2022-02-17T00:00:00Z",
    downloads: 45,
    source: OtherResourceSource.CurseForge,
  },
  {
    type: OtherResourceType.Mod,
    name: "OptiFine",
    description: "A Minecraft mod that optimizes Minecraft's graphics.",
    iconSrc: "/images/icons/GrassBlock.png",
    tags: ["Graphics", "Optimization"],
    lastUpdated: "2022-02-17T00:00:00Z",
    downloads: 14,
    source: OtherResourceSource.CurseForge,
  },
];
