import { ArrowLeftOutlined } from "@ant-design/icons";
import { Button, Flex, Typography } from "antd";

export interface SubSettingsTopBarProps {
  /** 中文注释：子页标题，与业务一致（如「久坐提醒」）。 */
  title: string;
  onBack: () => void;
}

/** 中文注释：子页顶栏——左上图标返回（无文字）+ 标题，三页同构。 */
export default function SubSettingsTopBar(props: SubSettingsTopBarProps): JSX.Element {
  const { title, onBack } = props;
  return (
    <Flex align="center" gap={8} wrap="wrap" style={{ marginBottom: 12 }}>
      <Button
        type="text"
        icon={<ArrowLeftOutlined />}
        onClick={onBack}
        aria-label="返回主界面"
        title="返回主界面"
      />
      <Typography.Title level={5} style={{ margin: 0 }}>
        {title}
      </Typography.Title>
    </Flex>
  );
}
