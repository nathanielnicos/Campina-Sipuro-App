import DocumentFlowHeader from './DocumentFlowHeader';
import DOTab from '../do-tab/DOTab';
import SITab from '../si-tab/SITab';

// Custom Hooks
import { useDocumentFlowPage } from '../../../hooks/documentFlow/page/useDocumentFlowPage';

const DocumentFlowPage = ({ currentUser }) => {
    // Hook Utama Halaman Batch
    const {
        reloadTrigger,
        activeTab,
        setActiveTab,
        handleTriggerReload
    } = useDocumentFlowPage();

    return (
        <div style={{ padding: '0px 20px 20px 20px', fontFamily: 'sans-serif' }}>
            <DocumentFlowHeader
                activeTab={activeTab}
                onTabChange={setActiveTab}
                currentUser={currentUser}
                onSuccessSave={handleTriggerReload}
            />

            <div>
                {activeTab === 'DELIVERY_ORDER' && (
                    <DOTab
                        currentUser={currentUser}
                        reloadTrigger={reloadTrigger}
                    />
                )}
                {activeTab === 'SALES_INVOICE' && (
                    <SITab
                        currentUser={currentUser}
                        reloadTrigger={reloadTrigger}
                    />
                )}
            </div>
        </div>
    );
};

export default DocumentFlowPage;
