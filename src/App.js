import { Button, Layout, Menu } from "antd";
import WalletConnectPage from './pages/walletconnect';
import WalletConnectConnectorPage from './pages/walletconnect-connector';
import AstraConnectorPage from './pages/astra-connector';
import PageLayout from './components/PageLayout';
import {
  createBrowserRouter,
  RouterProvider,
} from "react-router-dom";

const router = createBrowserRouter([
  {
    path: "/",
    element: <PageLayout isHome />,
  },
  {
    path: "/wallet-connect",
    element: <WalletConnectPage />,
  },
  {
    path: "/wallet-connect-connector",
    element: <WalletConnectConnectorPage />,
  },
  {
    path: "/astra-connector",
    element: <AstraConnectorPage />,
  },
]);

export default ({
  
}) => {
  return <RouterProvider router={router} />
};
