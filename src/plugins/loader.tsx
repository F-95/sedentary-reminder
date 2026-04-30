import { Alert, Space } from "antd";

export interface PluginDescriptor {
  id: string;
  name: string;
  enabled: boolean;
}

export function PluginHost(): JSX.Element {
  const plugins: PluginDescriptor[] = [];
  if (plugins.length === 0) {
    return <></>;
  }
  return (
    <Space direction="vertical" style={{ width: "100%", marginTop: 16 }}>
      {plugins.map((plugin) => (
        <Alert key={plugin.id} type="success" message={`插件已加载: ${plugin.name}`} showIcon />
      ))}
    </Space>
  );
}
