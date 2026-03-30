import {
  Accordion,
  AccordionButton,
  AccordionIcon,
  AccordionItem,
  AccordionPanel,
  Box,
  BoxProps,
  Code,
  Divider,
  Heading,
  Icon,
  Image,
  Link,
  ListItem,
  OrderedList,
  Text,
  UnorderedList,
} from "@chakra-ui/react";
import { openUrl } from "@tauri-apps/plugin-opener";
import React from "react";
import { useTranslation } from "react-i18next";
import { LuLightbulb } from "react-icons/lu";
import ReactMarkdown, { Components } from "react-markdown";
import { BeatLoader } from "react-spinners";
import remarkGfm from "remark-gfm";
import { ToolCallWidget } from "@/components/tool-call-widget";
import { useLauncherConfig } from "@/contexts/config";
import { splitByToolCalls } from "@/utils/tool-call/parser";

type MarkdownContainerProps = BoxProps & {
  children: string;
  messageId?: string;
  onToolCallAction?: (action: "confirm" | "cancel") => void;
};

type ThinkSegment = {
  type: "normal" | "think";
  content: string;
  isFinished?: boolean;
};

function splitThinkSegments(text: string): ThinkSegment[] {
  const segments: ThinkSegment[] = [];
  let cursor = 0;

  while (cursor < text.length) {
    const openIdx = text.indexOf("<think>", cursor);
    if (openIdx === -1) {
      segments.push({ type: "normal", content: text.slice(cursor) });
      break;
    }

    if (openIdx > cursor) {
      segments.push({ type: "normal", content: text.slice(cursor, openIdx) });
    }

    const thinkContentStart = openIdx + "<think>".length;
    const closeIdx = text.indexOf("</think>", thinkContentStart);

    if (closeIdx === -1) {
      segments.push({
        type: "think",
        content: text.slice(thinkContentStart),
        isFinished: false,
      });
      break;
    }

    segments.push({
      type: "think",
      content: text.slice(thinkContentStart, closeIdx),
      isFinished: true,
    });
    cursor = closeIdx + "</think>".length;
  }

  return segments.filter((segment) => segment.content.trim().length > 0);
}

const MarkdownContainer: React.FC<MarkdownContainerProps> = ({
  children,
  messageId,
  onToolCallAction,
  ...boxProps
}) => {
  const { t } = useTranslation();
  const { config } = useLauncherConfig();
  const primaryColor = config.appearance.theme.primaryColor;

  // process GitHub-style mentions and issue / PR references
  const processGitHubMarks = React.useCallback(
    (text: string): React.ReactNode => {
      const parts = text.split(/(\#[0-9]+|\@[a-zA-Z0-9_-]+)/g);
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
    },
    [primaryColor]
  );

  // Process both tool calls and GitHub marks
  const processContent = React.useCallback(
    (children: React.ReactNode): React.ReactNode => {
      if (typeof children === "string") {
        const segments = splitByToolCalls(children);
        const result: React.ReactNode[] = [];

        let toolIndex = 0;
        segments.forEach((segment, i) => {
          if (typeof segment === "string") {
            result.push(processGitHubMarks(segment));
          } else {
            if (segment.type === "success") {
              result.push(
                <ToolCallWidget
                  key={`fn-${i}`}
                  data={{ name: segment.name, params: segment.params }}
                  callId={messageId ? `${messageId}-${toolIndex}` : undefined}
                  onConfirmationAction={onToolCallAction}
                />
              );
              toolIndex++;
            } else {
              result.push(
                <Code key={`err-${i}`} colorScheme="red" fontSize="xs">
                  {segment.error}
                </Code>
              );
            }
          }
        });
        return result;
      }

      if (Array.isArray(children)) {
        return children.map((child, i) => (
          <React.Fragment key={i}>{processContent(child)}</React.Fragment>
        ));
      }

      if (React.isValidElement(children)) {
        const childProps = children.props?.children ?? null;
        return React.cloneElement(children, {
          ...children.props,
          children: processContent(childProps),
        } as any);
      }

      return children;
    },
    [processGitHubMarks, messageId, onToolCallAction]
  );

  // map HTML tags to Chakra components so styles are inherited.
  const components: Components = React.useMemo(
    () => ({
      // paragraphs
      p: ({ node, children, ...rest }) => (
        <Text {...rest}>{processContent(children)}</Text>
      ),
      // headings
      h1: ({ node, children, ...rest }) => (
        <Heading as="h1" size="xl" my={4} {...rest}>
          {processContent(children)}
        </Heading>
      ),
      h2: ({ node, children, ...rest }) => (
        <Heading as="h2" size="lg" my={3} {...rest}>
          {processContent(children)}
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
      strong: ({ node, children, ...rest }) => (
        <Text as="strong" fontWeight="600" color="inherit" {...rest}>
          {processContent(children)}
        </Text>
      ),
      em: ({ node, children, ...rest }) => (
        <Text as="em" fontStyle="italic" color="inherit" {...rest}>
          {processContent(children)}
        </Text>
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
          {processContent(children)}
        </UnorderedList>
      ),
      ol: ({ node, children, ...rest }) => (
        <OrderedList pl={5} my={2} {...rest}>
          {processContent(children)}
        </OrderedList>
      ),
      li: ({ node, children, ...rest }) => (
        <ListItem my={1} {...rest}>
          {processContent(children)}
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
      // code
      code: ({ node, className, children, ...rest }) => {
        // If inline code matches tool marker pattern
        if (typeof children === "string") {
          const funcMatch = children.match(/^::(?:tool|function)::(\{.*\})$/);
          if (funcMatch) {
            try {
              const data = JSON.parse(funcMatch[1]);
              // Inline code doesn't easily support knowing the index if multiple exist,
              // but we can assume index 0 for simplicity or improve parse logic later.
              // For now we skip callId for inline code blocks as they are edge cases.
              return <ToolCallWidget data={data} />;
            } catch (e) {
              // ignore
            }
          }
        }

        return (
          <Code bg="unset" className={className} {...rest}>
            {children}
          </Code>
        );
      },
    }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [processContent]
  );

  const thinkSegments = React.useMemo(
    () => splitThinkSegments(children || ""),
    [children]
  );

  const renderMarkdown = React.useCallback(
    (content: string, key: string) => (
      <ReactMarkdown
        key={key}
        remarkPlugins={[remarkGfm]}
        components={components}
      >
        {content}
      </ReactMarkdown>
    ),
    [components]
  );

  return (
    <Box {...boxProps}>
      {thinkSegments.length === 0
        ? renderMarkdown(children || "", "markdown-default")
        : thinkSegments.map((segment, index) => {
            if (segment.type === "normal") {
              return renderMarkdown(segment.content, `markdown-${index}`);
            }

            return (
              <Accordion key={`think-${index}`} allowToggle my={2}>
                <AccordionItem border="unset" borderRadius="md">
                  <AccordionButton px={0} py={2}>
                    {segment.isFinished ? (
                      <Icon size={4} as={LuLightbulb} />
                    ) : (
                      <BeatLoader size={4} />
                    )}
                    <Text
                      flex="1"
                      textAlign="left"
                      fontSize="sm"
                      fontWeight="600"
                      ml={2}
                    >
                      {segment.isFinished
                        ? t("AgentChatPage.thinkingFinished")
                        : t("AgentChatPage.thinking")}
                    </Text>
                    <AccordionIcon />
                  </AccordionButton>
                  <AccordionPanel px={0} pt={1} pb={3}>
                    {renderMarkdown(segment.content, `think-markdown-${index}`)}
                  </AccordionPanel>
                </AccordionItem>
              </Accordion>
            );
          })}
    </Box>
  );
};

export default MarkdownContainer;
