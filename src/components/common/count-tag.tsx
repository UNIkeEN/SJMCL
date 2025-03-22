import { Tag, TagLabel, TagProps, useColorModeValue } from "@chakra-ui/react";

interface CountTagProps extends TagProps {
  count?: number | string;
  children?: React.ReactNode;
}

const CountTag: React.FC<CountTagProps> = ({ count, children, ...props }) => (
  <Tag
    borderRadius="full"
    colorScheme={useColorModeValue("blackAlpha", "gray")}
    {...props}
  >
    <TagLabel>{count || Number(children) || 0}</TagLabel>
  </Tag>
);

export default CountTag;
