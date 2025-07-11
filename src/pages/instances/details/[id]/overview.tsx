import { Section } from "@/components/common/section";
import { WrapCardGroup } from "@/components/common/wrap-card";
import {
  InstanceBasicInfoWidget,
  InstanceLastPlayedWidget,
  InstanceModsWidget,
  InstanceMoreWidget,
  InstanceScreenshotsWidget,
} from "@/components/instance-widgets";

const InstanceOverviewPage = () => {
  const widgetList = [
    { content: <InstanceBasicInfoWidget />, colSpan: 1 },
    { content: <InstanceLastPlayedWidget />, colSpan: 1 },
    { content: <InstanceModsWidget />, colSpan: 1 },
    { content: <InstanceScreenshotsWidget />, colSpan: 1 },
    { content: <InstanceMoreWidget />, colSpan: 1 },
  ];

  return (
    <Section>
      <WrapCardGroup
        items={widgetList.map((widget) => ({
          cardContent: widget.content,
          colSpan: widget.colSpan,
          h: 152, // 41.8 / 1.1 * 4px
        }))}
      />
    </Section>
  );
};

export default InstanceOverviewPage;
