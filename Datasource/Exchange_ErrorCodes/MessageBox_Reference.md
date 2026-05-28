# MessageBox & Error Code Reference
> Auto-extracted from `/home/greek/git_1209/fusion_rhl_8`  
> Generated: 2026-05-28  
> Covers: MessageBox/AfxMessageBox calls · ERR_/ERROR_/GRK_ defines · GIC_/GRC_ GreekSoft codes · .ini key relationships

---

## 1. MessageBox / Dialog Messages

| Message Text | File (relative) | Line | Debug Only | Purpose / When It Appears | Related .ini Key | Related .ini File |
|---|---|---|---|---|---|---|
| `"ContractMaster.csv file is not in proper format please provide correct ncdex_contract.txt file"` | `CommonComps/QuickInMemory/MySQLGreekDGCXToken.cpp` | 409, 568 | No | Shown when NCDEX/DGCX contract CSV is malformed during token upload | — | — |
| `"ContractMaster.csv file is not in proper format please provide correct ncdex_contract.txt file"` | `CommonComps/QuickInMemory/PostgresqlGreekDGCXToken.cpp` | 403, 562 | No | Same as above but for PostgreSQL token loader | — | — |
| `"Exception in SendDataToNext .........4"` | `Manager/ChartManager/tcpclientinteraction.cpp` | 399 | No | Exception in ChartManager TCP send thread (step 4) | — | — |
| `"Socket DecompBuff Buffer size is Small, Kindly increase."` | `Manager/ChartManager/tcpclientinteraction.cpp` | 416 | No | Decompression buffer overflow in ChartManager TCP client | — | — |
| `"Exception in SendDataToNext .........2"` | `Manager/ChartManager/tcpclientinteraction.cpp` | 438 | No | Exception in ChartManager TCP send (step 2) | — | — |
| `"Exception in SendDataToNext .........5"` | `Manager/ChartManager/tcpclientinteraction.cpp` | 464, 488 | No | Exception in ChartManager TCP send (step 5) | — | — |
| `"Exception in SendDataToNext .........8"` | `Manager/ChartManager/tcpclientinteraction.cpp` | 501 | No | Exception in ChartManager TCP send (step 8) | — | — |
| `"Exception in SendDataToNext .........7"` | `Manager/ChartManager/tcpclientinteraction.cpp` | 555 | No | Exception in ChartManager TCP send (step 7) | — | — |
| `"Client Socket not found in Map Intraday"` | `Manager/ChartManager/tcpclientinteraction.cpp` | 1150 | No | Client socket missing from intraday map during chart data send | — | — |
| `"Client Socket not found in Map Intraday"` | `Manager/ChartManager/tcpinteraction.cpp` | 4806 | No | Same — different interaction class | — | — |
| `"Unable to Connect Exchane TCP port for Currency Market"` | `Manager/NSEInteractive/processdatathread.cpp` | 610 | No | NSE Interactive cannot connect to exchange TCP for currency segment | — | — |
| `"Unable to Process OnIPCResponse"` | `Manager/NSEBroadCast/IPCResponseHandler.cpp` | 47 | No | IPC response handler failed in NSE Broadcast | — | — |
| `"Exception In BrokerageCalculation::InitializeBrokeragecalcmap()"` | `Manager/RMS/BrokerageCalculation.cpp` | 97 | No | Exception during RMS brokerage map initialisation | — | — |
| `"Exception In BrokerageCalculation::UpdateBrokerageTemplateMapper()"` | `Manager/RMS/BrokerageCalculation.cpp` | 119 | No | Exception updating brokerage template mapper | — | — |
| `"Exception In BrokerageCalculation::UpdateBrokerageTemplate()"` | `Manager/RMS/BrokerageCalculation.cpp` | 145 | No | Exception updating brokerage template | — | — |
| `"Exception In BrokerageCalculation::Fetchbrokerage()"` | `Manager/RMS/BrokerageCalculation.cpp` | 196 | No | Exception fetching brokerage record | — | — |
| `"Exception In BrokerageCalculation::CalcARBExpense()"` | `Manager/RMS/BrokerageCalculation.cpp` | 225 | No | Exception calculating ARB/spread expense | — | — |
| `"Exception In BrokerageCalculation::CalcEQExpense()"` | `Manager/RMS/BrokerageCalculation.cpp` | 371 | No | Exception calculating EQ brokerage expense | — | — |
| `"Exception In BrokerageCalculation::CalcFOExpense()"` | `Manager/RMS/BrokerageCalculation.cpp` | 429 | No | Exception calculating F&O brokerage expense | — | — |
| `"Fail To Load CommonIncludes.dll"` | `Manager/BroadcastStorage/broadcaststorage.cpp` | 4574 | No | CommonIncludes DLL failed to load at BroadcastStorage startup | — | — |
| `"BroadcastStorage.cpp::CommonIncludeHandle() - g_pStoreInLogfile pointer is NULL"` | `Manager/BroadcastStorage/broadcaststorage.cpp` | 4580 | No | Log file pointer null after DLL load | — | — |
| `"Exception in CMainFrame::GetNNFField"` | `Manager/ClientCommunicator/ResponseProcessing.cpp` | 14458 | No | Exception reading NNF (NEAT Network Field) in response processing | — | — |
| `"Exception in ResponseProcessing::InsertProductConversionMessageInAuditTrailDB"` | `Manager/ClientCommunicator/ResponseProcessing.cpp` | 14876 | No | Exception inserting product conversion audit record | — | — |
| `"Exception in CMainFrame::GetNNFField"` | `Manager/ClientCommunicator/GeneralFunctions.cpp` | 15109 | No | Same NNF exception in general functions | — | — |
| *(dynamic cMessage)* | `Manager/FIXInteractive/fixengine.cpp` | 26043 | No | FIX Engine exception — message built dynamically | — | — |
| *(dynamic cMessage)* | `Manager/FIXInteractive/FIXEngine44.cpp` | 52225 | No | FIX Engine 4.4 exception — message built dynamically | — | — |
| *(dynamic cMessage)* | `Manager/TechnicalOrderProcessor/Script.cpp` | 2488 | No | Script engine exception — message built dynamically | — | — |

### Notes on MessageBox usage
- `AfxMessageBox` = MFC-style modal dialog (legacy Windows code, may not render on Linux)
- `MessageBox(NULL, ...)` = Win32 API dialog
- `DisplayMessageBox` / `onSignalDisplayMessageBox` / `displayMessageBox` = Qt signal/slot wrappers in CTCLManager and ClientCommunicator; these ARE active on Linux
- No `WritePrivateProfileString` calls found — all .ini writes go through Qt `QSettings`

---

## 2. Error Code Defines (ERR_* / ERROR_*)

### Exchange / RMS Error Codes
| Code Name | Value | File (relative) | Line | Purpose |
|---|---|---|---|---|
| `ERR_PRICE_NOT_MULT_TICK_SIZE` | 16283 | `CommonComps/CommonFiles/CommonHashDefines.h` | 185 | Price not a multiple of tick size — exchange rejection |
| `ERR_PRICE_OUTSIDE_REVISED_PRICE_RANGE` | 16521 | `CommonComps/CommonFiles/CommonHashDefines.h` | 188 | Price outside revised/circuit-breaker range |
| `ERR_PARTICIPANT_ORD_NOT_ALLOWED` | 16700 | `CommonComps/CommonFiles/CommonHashDefines.h` | 189 | Participant not allowed to place orders in this segment |
| `ERR_MKT_ORDER_NOT_ALLOWED_FO` | 17181 | `CommonComps/CommonFiles/CommonHashDefines.h` | 217 | Market order not allowed in F&O segment |
| `ERR_TRADE_BEYOND_MARKUP_PRICE_FO` | 17182 | `CommonComps/CommonFiles/CommonHashDefines.h` | 218 | Trade price beyond markup limit in F&O |
| `ERR_ORDER_MODIFY_REJ` | 16346 | `CommonComps/CommonFiles/CommonHashDefines.h` | 222 | Order modification rejected by exchange |
| `ERR_BOX_RATE_EXCEEDED_AT_MILLISECOND_LEVEL_FO` | 16420 | `CommonComps/CommonFiles/CommonHashDefines.h` | 4300 | Order rate limit exceeded at millisecond level (F&O) |
| `ERR_ALGO_ID_DISABLED` | 17185 | `CommonComps/QuickInMemory/HashDefines.h` | 814 | Algo ID is disabled — order rejected |
| `ERR_ORDER_CANCELLED_ALGOID_DISABLED` | 17186 | `CommonComps/QuickInMemory/HashDefines.h` | 815 | Pending order auto-cancelled because algo ID was disabled |
| `ERROR_HB_RATE_EXCEEDED` | 17107 | `CommonComps/QuickInMemory/HashDefines.h` | 816 | Heartbeat rate limit exceeded |
| `ERR_FUNCTION_NOT_AVAILABLE` | 16052 | `CommonComps/QuickInMemory/HashDefines.h` | 817 | Function / feature not available in this session |
| `ERR_PREOPEN_ORDER_REJECT` | 16601 | `CommonComps/QuickInMemory/HashDefines.h` | 822 | Order rejected during pre-open session |
| `ERROR_BAD_TRANS_CODE` | 16003 | `Manager/NSEInteractiveA/directnnf.cpp` | 19 | Bad transaction code sent to NSE NEAT engine |
| `ERROR_MULTIPLE_REQ` | 19029 | `Manager/NSEInteractiveA/directnnf.cpp` | 21 | Multiple simultaneous requests — throttle violation |
| `ERROR_TRY_LATER` | 19031 | `Manager/NSEInteractiveA/directnnf.cpp` | 23 | Exchange busy — retry later |
| `ERROR_BAD_TRANS_CODE` | 16003 | `Manager/NSEInteractive_OFS/directnnf.cpp` | 19 | Same as above for OFS market |
| `ERROR_MULTIPLE_REQ` | 19029 | `Manager/NSEInteractive_OFS/directnnf.cpp` | 21 | Same as above for OFS market |
| `ERROR_TRY_LATER` | 19031 | `Manager/NSEInteractive_OFS/directnnf.cpp` | 23 | Same as above for OFS market |

### Internal / Utility Error Codes
| Code Name | Value | File (relative) | Line | Purpose |
|---|---|---|---|---|
| `ERROR_CODE` | 10010 | `DynamicMulticast/DynamicTBTReceiver.h` | 58 | Generic TBT receiver error code |
| `ERROR_RECORD_MISMATCH` | 1 | `Utilities/Greek_Utility/MyHashDefines.h` | 74 | Generic record mismatch in reconciliation |
| `ERROR_EQ_RECORD_MISMATCH` | 1 | `Utilities/Greek_Utility/MyHashDefines.h` | 75 | EQ segment record mismatch |
| `ERROR_FO_RECORD_MISMATCH` | 2 | `Utilities/Greek_Utility/MyHashDefines.h` | 76 | F&O segment record mismatch |
| `ERROR_BOTH_RECORD_MISMATCH` | 3 | `Utilities/Greek_Utility/MyHashDefines.h` | 77 | Both EQ and F&O records mismatched |
| `ERROR_LOG_FILE` | `"ErrorsInCTCLClient"` | `CommonComps/QuickInMemory/HashDefines.h` | 343 | Log filename prefix for CTCL client errors |
| `ERROR_LOG_FILE_BCAST` | `"StoreBCastDataDll"` | `Manager/BroadcastStorage/BroadcastStorage_global.h` | 37 | Log filename for BroadcastStorage DLL errors |
| `ERROR_CODE_LENGTH` | 3 | `Manager/GreekStructMap/iBBS_HashDefines.h` | 9 | Max length of BSE/iBBS error code string |
| `ERROR_MESSAGE_LENGTH` | 250 | `Manager/GreekStructMap/iBBS_HashDefines.h` | 14 | Max length of BSE/iBBS error message string |

---

## 3. GreekSoft GIC_ Message Type Codes

> Primary definition file: `CommonComps/QuickInMemory/HashDefines.h`  
> Secondary / utility: `Utilities/Greek_Utility/MyHashDefines.h`  
> Duplicates (commented) also in: `Manager/ClientCommunicator/MyHashDefines.h`, `Manager/RMS/rms_globals.h`

### Order Lifecycle Codes
| Code Name | Value | Purpose |
|---|---|---|
| `GIC_ORDER_REQ` | 5501 | New order request from client to Manager |
| `GIC_BOARD_LOT_IN` | 5501 | Board lot order inbound (alias) |
| `GIC_ORDER_MOD_IN` | 5505 | Order modification request in |
| `GIC_ORDER_MOD_OUT` | 5506 | Order modification sent to exchange |
| `GIC_ORDER_MOD_REJECT` | 5507 | Order modification rejected |
| `GIC_ORDER_CANCEL_REQ` | 5508 | Order cancel request from client |
| `GIC_ORDER_CANCEL_OUT` | 5509 | Order cancel sent to exchange |
| `GIC_ORDER_CANCEL_REJECT` / `GIC_ORDER_CANCEL_REJ` / `IC_ORDER_CANCEL_REJ` | 5510 | Order cancel rejected by exchange |
| `GIC_ORDER_CONFIRM_RES` | 5511 | New order confirmed by exchange |
| `GIC_ORDER_MOD_CONFIRMATION` | 5512 | Modification confirmed by exchange |
| `GIC_ORDER_CANCEL_CONFIRM_RES` | 5513 | Cancel confirmed by exchange |
| `GIC_CANCEL_NEG_ORDER` | 5514 | Cancel negotiated order |
| `GIC_FREEZE_TO_CONTROL` | 5515 | Order frozen/controlled by RMS |
| `GIC_ORDER_ERROR` | 5516 | Generic order error |
| `GIC_BATCH_ORDER_CANCEL` | 5517 | Batch cancel request |
| `GIC_MANAGER_NEW_ORD_RES` | 5520 | Manager new order response to CC |
| `GIC_PRICE_CONFIRMATION` | 5527 | Price confirmation for order |

### Offline / Pre-Open Order Codes
| Code Name | Value | Purpose |
|---|---|---|
| `GIC_ORD_OFFLINE_REQ` | 5528 | Offline/AMO/pre-open order request |
| `GIC_ORD_OFFLINE_CANCEL_REQ` | 5529 | Cancel request for offline order (never sent to exchange) |
| `GIC_ORD_OFFLINE_CANCEL_RES` | 5530 | Cancel success response for offline order |
| `GIC_ORD_OFFLINE_MODIFY_REQ` | 6628 | Modify request for offline order |
| `GIC_ORD_OFFLINE_MODIFY_RES` | 6629 | Modify response for offline order |

### Trade Codes
| Code Name | Value | Purpose |
|---|---|---|
| `GIC_ON_STOP_NOTIFICATION` | 5601 | Trade stop notification |
| `GIC_TRADE_ERROR` | 5603 | Trade error |
| `GIC_TRADE_CANCEL_CONFIRM` | 5604 | Trade cancel confirmed |
| `GIC_TRADE_CANCEL_REJECT` | 5605 | Trade cancel rejected |
| `GIC_TRADE_MODIFY_CONFIRM` | 5606 | Trade modify confirmed |
| `GIC_TRADE_MODIFY_REJECT` | 5607 | Trade modify rejected |
| `GIC_TRADE_CANCEL_IN` | 5608 | Trade cancel request in |
| `GIC_TRADE_CANCEL_OUT` | 5609 | Trade cancel sent out |
| `GIC_TRADE_MOD_IN` | 5610 | Trade modify request in |
| `GIC_TRADE_MOD_OUT` | 5611 | Trade modify sent out |

### Spread / Multi-Leg Order Codes
| Code Name | Value | Purpose |
|---|---|---|
| `GIC_TWO_LEG_ORD_REQ` | 5702 | Two-leg spread order request |
| `GIC_TWO_LEG_ORD_RES` | 5703 | Two-leg spread order response |
| `GIC_THREE_LEG_ORD_REQ` | 5704 | Three-leg spread order request |
| `GIC_THREE_LEG_ORD_RES` | 5705 | Three-leg spread order response |
| `GIC_SPREAD_ORD_MOD_REQ` | 5718 | Spread order modification request |
| `GIC_TWO_LEG_ORD_CONFIRM` | 5725 | Two-leg order confirmed |
| `GIC_THREE_LEG_ORD_CONFIRM` | 5726 | Three-leg order confirmed |
| `GIC_GREEK_SPREAD_BATCH_ORDER_CXL_OUT` | 5728 | Spread batch cancel out |
| `GIC_TWO_LEG_ORD_CXL_CONFIRM` | 5731 | Two-leg cancel confirmed |
| `GIC_THREE_LEG_ORD_CXL_CONFIRM` | 5732 | Three-leg cancel confirmed |
| `GIC_TWO_LEG_ORD_ERROR` | 5755 | Two-leg order error |
| `GIC_THREE_LEG_ORD_ERROR` | 5756 | Three-leg order error |

### Kill Switch / System Control Codes
| Code Name | Value | Purpose |
|---|---|---|
| `GIC_KILL_SWITCH_REQ` | 6507 | Kill switch request (cancel all orders for user/segment) |
| `GIC_KILL_SWITCH_MANAGER_RES` | 6508 | Kill switch response from Manager |
| `GIC_KILL_SWITCH_MANAGER_REQ` | 6509 | Kill switch request to Manager |
| `GIC_GATS_TRADE_CONFIRM` | 6510 | GATS trade confirmation |
| `GIC_CONTRACT_SECURITY_STATUS` | 6505 | Contract/security status update |
| `GIC_COL_STATUS` | 6506 | Collateral status update |
| `GIC_ORDER_CAPTURE_REQ` | 6601 | Order capture request |
| `GIC_TRADE_CAPTURE_REQ` | 6602 | Trade capture request |
| `GIC_ZERO_DOWNLOADING_REQ` | 8889 | Zero-download request (skip full contract download) |

### Token / Filter Codes
| Code Name | Value | Purpose |
|---|---|---|
| `GIC_GREEK_FILTER_TOKEN_ADD` | 50 | Add token to market data filter |
| `GIC_GREEK_FILTER_TOKEN_REMOVE` | 51 | Remove token from market data filter |

### Product / License Codes
| Code Name | Value | Purpose |
|---|---|---|
| `GIC_GREEK_LICENSED_PRODUCT` | 5906 | Licensed product list message |
| `GIC_GREEK_PRODUCT_ALLOWED` | 5907 | Allowed product list message |

### Exchange Order By Exchange Codes (MCXSX)
| Code Name | Value | Purpose |
|---|---|---|
| `GIC_ORDER_BY_EXCHANGE_REQ` | 5541 | Order initiated by exchange (MCXSX 7500) |
| `GIC_ORDER_MOD_BY_EXCHANGE_REQ` | 5542 | Modification initiated by exchange (MCXSX 7575) |
| `GIC_ORDER_CANCEL_BY_EXCHANGE_REQ` | 5543 | Cancel initiated by exchange (MCXSX 7650) |

### User Login Detail Codes
| Code Name | Value | Purpose |
|---|---|---|
| `GIC_USER_LOGINDETAILS_HEADER` | 6375 | Login details header packet |
| `GIC_USER_LOGINDETAILS_DATA` | 6376 | Login details data packet |
| `GIC_USER_LOGINDETAILS_TRAILER` | 6377 | Login details trailer packet |

### Historical / Gap-Fill Codes (selected)
| Code Name | Value Series | Purpose |
|---|---|---|
| `GIC_HISTORICAL_SEQ_MCXSX_ORDER_*` | 6801–6804 | MCXSX historical order download |
| `GIC_HISTORICAL_SEQ_MCXSX_TRADES_*` | 6817–6820 | MCXSX historical trade download |
| `GIC_HISTORICAL_SEQ_MCXSX_EQ_*` | 8851–8862 | MCXSX EQ historical download |
| `GIC_HISTORICAL_SEQ_MCXSX_FO_*` | 8863–8882 | MCXSX FO historical download |
| `GIC_HISTORICAL_SEQ_BSE_CD_*` | 8883–8890 | BSE CD historical download |
| `GIC_HISTORICAL_SEQ_BSE_FO_*` | 9910–9925 | BSE FO historical download |
| `GIC_HISTORICAL_SEQ_NSE_OFS_PENDINGORDERS_*` | 9930–9933 | NSE OFS pending orders download |
| `GIC_HISTORICAL_GTD_ORDER_*` | 9942–9945 | GTD (Good Till Date) order history |
| `GIC_GAPFILL_PENDINGORDERS_*` | 7932–7935 | Gap-fill pending orders |
| `GIC_GAPFILL_TRADEINFO_*` | 7940–7943 | Gap-fill trade info |
| `GIC_CLIENT_GAPFILL_PENDINGORDERS_*` | 7966–7969 | Client-side gap-fill pending orders |
| `GIC_CLIENT_GAPFILL_TRADEINFO_*` | 7974–7977 | Client-side gap-fill trade info |
| `GIC_HISTORICAL_GREEK_JOBBING_*` | 9600–9603 | Greek jobbing historical data |
| `GIC_HISTORICAL_CONVERSIONFACTOR_*` | 7011–7016 | Conversion factor download/management |

### GRC_ Component / Category Codes
| Code Name | Value | Purpose |
|---|---|---|
| `GRC_CONSOL_CAT` | 27 | Consolidated category identifier |

> Full `GRC_` string constants (component routing IDs) are defined as `static const char*` in  
> `CommonComps/CommonFiles/CommonHashDefines.h` — e.g. `GRC_CTCLMANAGER="1 1"`, `GRC_NSEINTERACTIVE="2 1"`, `GRC_BSEINTERACTIVE="2 2"`, `GRC_NSE_EQ_BROADCAST="3 1"`, `GRC_GMBS="3 22"`.

---

## 4. .ini File Inventory & Key Relationships

### CTCLManager.ini
**Used by:** `CommonComps/CommonFiles/masterconfig.h` (via `QSettings`)  
**Read at:** startup via `gs::MasterConfig::getInstance()`

| .ini Key | Purpose / Triggered Behaviour | Related Code / Error |
|---|---|---|
| `CARRY_GREEK_POSITIONS_UPTO_MONTH` | Controls whether Greek positions roll forward to next month | `TableCreation.cpp:17732, 22200` — logged as qDebug if flag missing |
| `SendBroadcastToClient` | Enables/disables sending broadcast data to client | `NSEBroadCast/mainwindow.cpp:1790`; `TcpServer.cpp:4002` — sets `UDPClientSocket::m_bSendBroadcastToClient` |
| SSL certificate path key | Path to BSE ETI SSL certificate file | `ETIInteractive/SSLUtilities.cpp:352` — logs `"Certificate file not found! Please check certificate path in CTCLManager.ini"` if missing |

### BCManager_TBTClientSettings (IniFormat)
**Used by:** `BroadcastManager/mainwindow.cpp`, `TBTReceiver.cpp`, `FASTChannelConnection.cpp`  
**Purpose:** TBT (Tick-By-Tick) client connection settings — IP, port, multicast group for broadcast feeds.

### BCManager_TBTServerSettings (IniFormat)
**Used by:** `BroadcastManager/mainwindow.cpp`, `TBTMulticast.cpp`, `EOBIDirectChannel.cpp`, `solacesettings.cpp`  
**Purpose:** TBT server-side settings — bind address, multicast publish settings, EOBI channel configuration.

### TBTClientSettings (IniFormat)
**Used by:** `DynamicMulticast/DynamicTBTMulticast.cpp`, `TBTFeedProvider/TBTReceiver.cpp`, `TBTFeedProvider/mainwindow.cpp`  
**Purpose:** TBT feed provider client settings.

### TBTServerSettings_2 (IniFormat)
**Used by:** `TBTFeedProvider/TBTMulticast.cpp`, `TBTFeedProvider/mainwindow.cpp`, `TBTReceiver.h`  
**Purpose:** TBT feed provider server/publish settings.

### TBTServerSettings (IniFormat)
**Used by:** `GreekBroadcastProvider/mainwindow.cpp`, `BroadcastManager/FASTBroadcastManager.cpp`  
**Purpose:** FAST/GreekBroadcastProvider server settings.

### GBPSettings (IniFormat)
**Used by:** `GreekBroadcastProvider/mainwindow.cpp`  
**Purpose:** GreekBroadcastProvider (GBP) connection and session settings.

### AllowedExchange (IniFormat)
**Used by:** `Manager/NSEInteractiveA/main.cpp:514`, `Manager/MCXSXInteractive/main.cpp:204`  
**Purpose:** Controls which exchange segments are enabled for the NSE/MCXSX Interactive process at startup.

### ChartManagerSettings (IniFormat)
**Used by:** `Manager/ChartManager/mainwindow.cpp`  
**Purpose:** ChartManager TCP connection settings — NSE, BSE, MCX, NCDEX endpoints.

### Greekmonitoringtoolsetting (IniFormat)
**Used by:** `Manager/GreekMonitoringTools/greekmemorymonitoring.cpp:408`  
**Purpose:** Memory monitoring tool configuration.

### GATSAIParameters.ini
**Used by:** `Manager/AIEngine/processarbitragerule.cpp:110–128`  
**Purpose:** AI/GATS arbitrage engine parameters — read/written with `fopen`/`fprintf` (not QSettings).

---

## 5. Debug / Conditional Compilation Guards

| Guard | File | Effect |
|---|---|---|
| `#ifdef _DEBUG` / `#ifdef DEBUG` | Various | Enables extra logging, assertions |
| `#ifdef DEBUG_BUILD` | `DynamicMulticast/DynamicTBTReceiver.cpp:691,701`; `BroadcastManager/NCDEXTBTFASTChannel.cpp:30` | Enables debug TBT path logging |
| `#ifdef BSE_OFFLINE_ORDER_LOGS_ENABLE` | `Manager/ETIInteractive/BSEETIInteractive.cpp` | Enables verbose offline order log entries to BSE_Interactive log file |
| `#ifdef OFFLINE_INFO_STORE_IN_ARRAY` | `Manager/ETIInteractive/BSEETIInteractive.h` | Chooses array vs map for offline order storage |
| `#ifdef __SPREAD_ENABLE` | `Manager/ETIInteractive/BSEInteractiveManager.cpp:23`; `Manager/NSEInteractiveA/GMain.cpp` | Enables spread/two-leg order support |
| `#ifdef LONGJUMP_BENCHMARK_IPC` | `Manager/ETIInteractive/BSEETIInteractive.cpp` | Enables IPC benchmark timing for order reject path |

---

## 6. Special Internal Sentinel Values

| Value | Name/Context | File | Purpose |
|---|---|---|---|
| `-999` | `iReasonCode = -999` | `BSEInteractiveManager.cpp`, `NSEInteractiveA/GMain.cpp` | Marks a synthetic/internal rejection — guards in `rmsliteValidation` skip `rms_cancel_order` when this is set AND `iGreekCode != GIC_ORDER_CANCEL_CONFIRM_RES` |
| `0` → `1` | `iRequestId` sentinel | `BSEETIInteractive.cpp`, `CRequestProcess.cpp` | `iRequestId=0` means no RMS deduction was made; set to `1` before calling `rmsliteValidation` to ensure margin is released |
| `MAX_MANUAL_OURORD_NO` | `lOurOrderNoAuto` threshold | `BSEETIInteractive.cpp` | Order numbers ≥ this value are automated/algo orders; used in `bisautomatedorder` flag for RMS |
