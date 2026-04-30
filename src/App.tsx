import { App as AntdApp, ConfigProvider, Layout } from "antd";
import HomePage from "@/pages/HomePage";
import { PluginHost } from "@/plugins/loader";

const { Content } = Layout;

export default function App(): JSX.Element {
  return (
    <ConfigProvider theme={{ token: { colorPrimary: "#1677ff", borderRadius: 10 } }}>
      <AntdApp>
        <Layout style={{ minHeight: "100vh" }}>
          <Content style={{ padding: 24 }}>
            <HomePage />
            <PluginHost />
          </Content>
        </Layout>
      </AntdApp>
    </ConfigProvider>
  );
}
