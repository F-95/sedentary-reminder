import { Card, Image, Space, Typography } from "antd";
import charlanWeixinBanner from "@/assets/charlan-weixin-banner.png";
import SubSettingsTopBar from "@/components/SubSettingsTopBar";

export interface AuthorBlurbPageProps {
  onBack: () => void;
}

/** 中文注释：作者随笔子页——纯展示，与统计等子页顶栏同构。 */
export default function AuthorBlurbPage(props: AuthorBlurbPageProps): JSX.Element {
  const { onBack } = props;
  return (
    <Space direction="vertical" size="middle" style={{ width: "100%" }}>
      <SubSettingsTopBar title="作者的哔哔赖赖" onBack={onBack} />
      <Card bordered>
        <Space direction="vertical" size="middle" style={{ width: "100%" }}>
          <Typography.Paragraph style={{ marginBottom: 0 }}>
            作者是一个十年程序员混子，爱吃不爱动，长期压抑的环境、体检单的异常……我终于幡然醒悟，健康才是伴侣。
          </Typography.Paragraph>
          <Typography.Paragraph style={{ marginBottom: 0 }}>
            我做这个软件的初衷，就是要它强制提醒我不要久坐；现在我把它分享出来给大家。
          </Typography.Paragraph>
          <Typography.Paragraph style={{ marginBottom: 0 }}>
            就在我写这段话的时候，提醒打断我了，算了，不写了。
          </Typography.Paragraph>
          <Typography.Paragraph style={{ marginBottom: 0 }}>最后，祝愿大家都有一个健康的身体！</Typography.Paragraph>
          <Typography.Paragraph type="secondary" style={{ marginBottom: 0, marginTop: 8 }}>
            我是乘澜，微信公众号：乘澜 charlan
          </Typography.Paragraph>
          <div style={{ textAlign: "center", width: "100%", marginTop: 8 }}>
            <Image
              src={charlanWeixinBanner}
              alt="乘澜 charlan 微信公众号，微信搜一搜"
              preview={false}
              style={{ maxWidth: 400, width: "100%" }}
            />
            <Typography.Text type="secondary" style={{ display: "block", marginTop: 8 }}>
              扫码或打开微信搜一搜「乘澜 charlan」
            </Typography.Text>
          </div>
        </Space>
      </Card>
    </Space>
  );
}
