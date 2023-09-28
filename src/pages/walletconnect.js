import PageLayout from "../components/PageLayout"
import {
  Button, Card, Form, Input, message, Select
} from 'antd';
import { useCallback, useEffect, useState } from 'react';
import axios from 'axios';
import _ from 'lodash';
import { hex2Bech32 } from '../utils';
import { SignClient, QRCodeModal, RELAY_URL } from "@astra-sdk/wallet-connect";
import { TxRaw } from "cosmjs-types/cosmos/tx/v1beta1/tx";
import { makeAuthInfoBytes, Registry } from "@cosmjs/proto-signing";
import { MsgSend } from "cosmjs-types/cosmos/bank/v1beta1/tx";
import { PubKey } from "cosmjs-types/cosmos/crypto/secp256k1/keys";
import { Any } from "cosmjs-types/google/protobuf/any";
import { Int53 } from "@cosmjs/math";
import { SignMode } from "cosmjs-types/cosmos/tx/signing/v1beta1/signing";
import { fromBase64 } from "@cosmjs/encoding";
import {
  AminoTypes,
  createBankAminoConverters
} from '@cosmjs/stargate';

const PROTOCOL = window.location.protocol === 'http' ? 'ws://' : 'wss://';
const DENOM = 'aastra';
const GAS_LIMIT = 260000;
const GAS_PRICE = 100000000000; // aastra
const NETWORKS = [
  {
    name: 'Testnet',
    key: 'testnet',
    rpc: 'https://rpc.astranaut.dev',
    api: 'https://api.astranaut.dev',
    chainId: 'astra_11115-1'
  },
  {
    name: 'Mainnet',
    key: 'mainnet',
    rpc: 'https://rpc.astranaut.dev',
    api: 'https://api.astranaut.dev',
    chainId: 'astra_11115-2'
  }
];
const NETWORK_PREFIX = 'astra-';
const broadcastTx = async (aminoResponse) => {
  const bankTypes = [
    ['/cosmos.bank.v1beta1.MsgSend', MsgSend],
  ];
  
  const REGISTRY = new Registry(bankTypes);
  
  const AMINO_TYPES = new AminoTypes({
    ...createBankAminoConverters(),
  });
  const sendTx = async tx => {
    // return;
    const params = {
      tx_bytes: Buffer.from(tx).toString('base64'),
      mode: 'BROADCAST_MODE_SYNC',
    };
    const {data} = await axios.post(NETWORKS[0].api + '/cosmos/tx/v1beta1/txs', params);
    return data;
  }
  // const decodedPubkey = Buffer.from(pubkeyBase58, 'base64');
  const signedGasLimit = Int53.fromString(String(aminoResponse.signed.fee.gas)).toNumber();
  const signedSequence = Int53.fromString(String(aminoResponse.signed.sequence)).toNumber();
  const signMode = SignMode.SIGN_MODE_LEGACY_AMINO_JSON;
  function encodePubkey(pubkey) {
    const pubkeyProto = PubKey.fromPartial({
      key: fromBase64(pubkey.value),
    });
    return Any.fromPartial({
      typeUrl: '/ethermint.crypto.v1.ethsecp256k1.PubKey',
      value: Uint8Array.from(PubKey.encode(pubkeyProto).finish()),
    });
  }
  const pubkey = encodePubkey(aminoResponse.signature.pub_key);
  const signedAuthInfoBytes = makeAuthInfoBytes(
    [{ pubkey, sequence: signedSequence }],
    aminoResponse.signed.fee.amount,
    signedGasLimit,
    signMode
  );
  const signedTxBody = {
    messages: aminoResponse.signed.msgs.map(i => AMINO_TYPES.fromAmino(i)),
    memo: aminoResponse.signed.memo,
  };
  const signedTxBodyEncodeObject = {
    typeUrl: '/cosmos.tx.v1beta1.TxBody',
    value: signedTxBody,
  };
  const signedTxBodyBytes = REGISTRY.encode(signedTxBodyEncodeObject);
  const txRaw = TxRaw.fromPartial({
    bodyBytes: Buffer.from(signedTxBodyBytes),
    authInfoBytes: Buffer.from(signedAuthInfoBytes),
    signatures: [
      fromBase64(aminoResponse.signature.signature, 'base64')
    ],
  });
  const tx = TxRaw.encode(txRaw).finish();
  console.log({
    bodyBytes: Buffer.from(signedTxBodyBytes),
    authInfoBytes: Buffer.from(signedAuthInfoBytes),
  })
  const broadcastResult = await sendTx(tx);
  console.log({broadcastResult})
}
const getAccountNumberAndSequence = async (address, api) => {
  try {
    const res = await axios({
      url: api + '/cosmos/auth/v1beta1/accounts/' + address
    })
    return {
      account_number: _.get(res, 'data.account.base_account.account_number'),
      sequence: _.get(res, 'data.account.base_account.sequence', 0),
    }
  } catch(e) {
    return {};
  }
};

const TransferForm = props => {
  const { onSubmit, loading } = props;
  
  const onFinish = (values) => {
    onSubmit(values)
  };

  const onFinishFailed = (errorInfo) => {
    console.log('Failed:', errorInfo);
  };

  return <Form
    onFinish={onFinish}
    onFinishFailed={onFinishFailed}
    autoComplete="off"
    initialValues={{
      address: 'astra17fn5x5nefxgnpgyfd59033l647xt44celq0x99',
      amount: '1'
    }}
    >

    <b>Transfer</b>
    <Form.Item
      label="To address"  
      name="address"
      rules={[{ required: true, message: 'Please input address!' }]} 
    >
      <Input />
    </Form.Item>
    <Form.Item
      label="Amount"  
      name="amount"
      type="number"
      rules={[{ required: true, message: 'Please input amount!' }]} 
    >
      <Input />
    </Form.Item>
    <div style={{textAlign: 'center'}}>
      <Button loading={loading} htmlType="submit" type="primary">Submit</Button>
    </div>
  </Form>
}

function App() {
  
  const [network, setNetwork] = useState(NETWORKS[0]);
  const [loading, setLoading] = useState(false);
  const [client, setClient] = useState(null);
  const [address, setAddress] = useState(null);
  const [session, setSession] = useState(null);

  const connected = !!address;

  const onChangeNetwork = useCallback((key) => {
    setNetwork(NETWORKS.find(n => n.key === key));
  }, []);

  const updateSession = useCallback((session) => {
    console.log({session})
    const allNamespaceAccounts = Object.values(session.namespaces)
      .map(namespace => namespace.accounts)
      .flat();
    const addresses = allNamespaceAccounts.map(str => str.split(':')[2]);
    const networks = allNamespaceAccounts.map(str => str.split(':')[1].substring(NETWORK_PREFIX.length));
    onChangeNetwork(networks[0]);

    // To sign in cosmos, you need to convert hex address to bech32 address
    setAddress(hex2Bech32(addresses?.[0]));
    setSession(session);
  }, [onChangeNetwork]);

  const connect = useCallback(async (topic) => {
    
    const { uri, approval } = await client.connect({
      pairingTopic: topic, // set pairingTopic with topic if you want to connect to a existed pairing
      requiredNamespaces: {
        astra: {
          chains: [`astra:${NETWORK_PREFIX}${network.key}`],
          events: [],
          methods: ["sign"], // sign method defined in AstraWallet
        },
      },
    });
    
    // use uri to show QRCode
    if (uri) {
      QRCodeModal.open(uri, () => {
        console.log("EVENT", "QR Code Modal closed");
      }, {
        mobileLinks: [],
        desktopLinks: []
      });
    }
     
    const session = await approval();
    if(session) {
      updateSession(session);
    }

    QRCodeModal.close();

  }, [client, network, updateSession]);

  const disconnect = useCallback(async (e) => {
    await client.disconnect({
      topic: session.topic,
      reason: '',
    });
    setAddress(null);
    setSession(null);
  }, [client, session?.topic]);

  useEffect(() => {
    (async () => {
      const client = await SignClient.init({
        relayUrl: 'wss://relay.walletconnect.com',
        projectId: 'af3dd8c81db591806b87e9dbdd42d670',
        metadata: {
          name: 'DEMO DAPP',
          description: 'Demo to connect via Wallet Connect',
          url: window.location.origin,
          icons: [
            `${window.location.origin}/logo192.png`
          ],
        },
      });
      
      // Restore current session
      if (client.session.length > 0) {
        const lastKeyIndex = client.session.keys.length - 1;
        const session = client.session.get(client.session.keys[lastKeyIndex]);
        updateSession(session);
      }
      
      // Add listeners for desired SignClient events
      client.on("session_event", (args) => {
        // Handle session events, such as "chainChanged", "accountsChanged", etc.
      });
      
      client.on("session_update", ({ topic, params }) => {
        const { namespaces } = params;
        const _session = client.session.get(topic);
        // Overwrite the `namespaces` of the existing session with the incoming one.
        const updatedSession = { ..._session, namespaces };
        // Integrate the updated session state into your dapp state.
        // onSessionUpdate(updatedSession);
      });
      
      client.on("session_delete", () => {
        // Session was deleted -> reset the dapp state, clean up from user session, etc.
      });
      
      setClient(client);
      
    })()
  }, [updateSession]);


  const onTransfer = useCallback(async ({address: recipient, amount}) => {
    setLoading(true);
    const { api, chainId } = network;
    const { topic } = session;
    const {account_number: accountNumber, sequence} = await getAccountNumberAndSequence(address, api);
    const signerData = {
      accountNumber,
      sequence,
      chainId,
    }
    const params = { 
      messages: [
        { 
          type: 'cosmos-sdk/MsgSend',
          value: {
            from_address: address,
            to_address: recipient,
            amount: [{
              amount: String(amount * 10 ** 18),
              denom: DENOM
            }]
          },
        }
      ], 
      fee: {
        amount: [{
          amount: String(GAS_LIMIT * GAS_PRICE),
          denom: DENOM
        }],
        gas: String(184737)
      }, 
      memo: "Send from walletconnect dapp", 
      signerData
    };
    
    try {
      const aminoResponse = await client.request({
        prompt: true,
        topic,
        chainId: `astra:${NETWORK_PREFIX}${network.key}`,
        request: {
          method: 'sign',
          params,
        },
      });

      broadcastTx(aminoResponse)
      message.success({content: 'Request approved!'})
    } catch(e) {
      console.log(e)
      message.error({content: e?.message})
    }

    setLoading(false);
  }, [address, client, network, session]);
  
  return (
    <PageLayout activeIndex={1}>
      {
        !connected && <>
          <Card style={{width: 300, margin: 'auto'}}>
            <Form.Item label={"Select network"}>
              <Select 
                placeholder="Select network"
                value={network}
                onChange={onChangeNetwork}
              >
                {
                  NETWORKS.map(n => <Select.Option value={n.key}>{n.name}</Select.Option>)
                }
              </Select>
            </Form.Item>
            <div className='text-center'>
              <Button disabled={!client} onClick={() => connect()} type="primary">{client ? 'Connect to wallet' : 'Initilizing connection'}</Button>
            </div>
          </Card>
        </>
      }
      {
        connected && <>
          <div style={{width: 300, margin: 'auto'}}>
          <Card>
            <Form.Item label="Selected network">
              <Input value={network?.name} readOnly />
            </Form.Item>
            <Form.Item label="Connected address">
              <Input.Group style={{ display: 'flex' }} compact>
                <Input readOnly value={address}/>
                <Button type="primary" onClick={disconnect}>Disconnect</Button>
              </Input.Group>
            </Form.Item>
            
          </Card>

          {connected && <div style={{marginTop: 30  }}>
            <TransferForm loading={loading} onSubmit={onTransfer} />
            </div>
          }
          </div>
        </>
      }


    </PageLayout>
  );
}

export default App;
