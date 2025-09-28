import {
  Box,
  BoxProps,
  Divider,
  Heading,
  Image,
  Link,
  ListItem,
  OrderedList,
  Text,
  UnorderedList,
} from "@chakra-ui/react";
import { openUrl } from "@tauri-apps/plugin-opener";
import React from "react";
import ReactMarkdown from "react-markdown";
import type { Components } from "react-markdown";
import remarkGfm from "remark-gfm";
import { useLauncherConfig } from "@/contexts/config";

type MarkdownContainerProps = BoxProps & {
  children: string;
};

const MarkdownContainer: React.FC<MarkdownContainerProps> = ({
  children,
  ...boxProps
}) => {
  const { config } = useLauncherConfig();
  const primaryColor = config.appearance.theme.primaryColor;

  // process GitHub-style mentions and issue / PR references
  const processGitHubMarks = (children: React.ReactNode) => {
    if (typeof children !== "string") return children;

    const parts = children.split(/(\#[0-9]+|\@[a-zA-Z0-9_-]+)/g);
    console.warn(parts);
    return parts.map((part, idx) => {
      if (/^#[0-9]+$/.test(part)) {
        const issueNumber = part.substring(1);
        return (
          <Link
            key={idx}
            color={`${primaryColor}.500`}
            onClick={() =>
              openUrl(
                `https://github.com/UNIkeEN/SJMCL/pull/${issueNumber}`
              ).catch(console.error)
            }
          >
            {part}
          </Link>
        );
      }
      if (/^@[a-zA-Z0-9_-]+$/.test(part)) {
        const username = part.substring(1);
        return (
          <Link
            key={idx}
            color={`${primaryColor}.500`}
            onClick={() =>
              openUrl(`https://github.com/${username}`).catch(console.error)
            }
          >
            {part}
          </Link>
        );
      }
      return <React.Fragment key={idx}>{part}</React.Fragment>;
    });
  };

  // map HTML tags to Chakra components so styles are inherited.
  const components: Components = {
    // paragraphs
    p: ({ node, children, ...rest }) => (
      <Text {...rest}>{processGitHubMarks(children)}</Text>
    ),
    // headings
    h1: ({ node, children, ...rest }) => (
      <Heading as="h1" size="xl" my={4} {...rest}>
        {processGitHubMarks(children)}
      </Heading>
    ),
    h2: ({ node, children, ...rest }) => (
      <Heading as="h2" size="lg" my={3} {...rest}>
        {processGitHubMarks(children)}
      </Heading>
    ),
    h3: ({ node, children, ...rest }) => (
      <Heading as="h3" size="md" my={2} {...rest}>
        {children}
      </Heading>
    ),
    h4: ({ node, children, ...rest }) => (
      <Heading as="h4" size="sm" my={2} {...rest}>
        {children}
      </Heading>
    ),
    // divider
    hr: ({ node, ...rest }) => <Divider my={4} {...rest} />,
    // links
    a: ({ node, href, children, ...rest }) => (
      <Link
        _hover={{ textDecoration: "underline" }}
        onClick={(e) => {
          e.preventDefault();
          if (href) openUrl(href);
        }}
        {...rest}
      >
        {children}
      </Link>
    ),
    // lists
    ul: ({ node, children, ...rest }) => (
      <UnorderedList pl={5} my={2} {...rest}>
        {processGitHubMarks(children)}
      </UnorderedList>
    ),
    ol: ({ node, children, ...rest }) => (
      <OrderedList pl={5} my={2} {...rest}>
        {processGitHubMarks(children)}
      </OrderedList>
    ),
    li: ({ node, children, ...rest }) => (
      <ListItem my={1} {...rest}>
        {processGitHubMarks(children)}
      </ListItem>
    ),
    // images
    img: ({ node, src, alt, ...rest }) => (
      <Image
        src={src}
        alt={alt}
        maxW="100%"
        my={2}
        borderRadius="md"
        {...rest}
      />
    ),
  };

  return (
    <Box {...boxProps}>
      <ReactMarkdown remarkPlugins={[remarkGfm]} components={components}>
        {children || ""}
      </ReactMarkdown>
    </Box>
  );
};

export default MarkdownContainer;
