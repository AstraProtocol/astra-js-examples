import { Button } from "antd"

export default ({children, isHome, activeIndex}) => {
  
  return <div className="container">
    <center style={{
      marginBottom: 20
    }}>
      <h1>Astra SDK</h1>
      {isHome && <div>
        <div style={{
          display: 'grid',
          gap: 20
        }}>
          <Button size="large" type={activeIndex === 1 ? 'primary' : ''} href="/wallet-connect">WalletConnect</Button>
          <Button size="large" type={activeIndex === 2 ? 'primary' : ''} href="/wallet-connect-connector">WalletConnect Connector</Button>
          <Button size="large" type={activeIndex === 3 ? 'primary' : ''} href="/astra-connector">Astra Connector</Button>
        </div>
      </div>}
      {
        !isHome && <a href="/">Back to home</a>
      }
    </center>
    {children}
  </div>
}