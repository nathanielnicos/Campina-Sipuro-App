import Header from './Header';
import OutstandingTable from '../outstanding-tab/OutstandingTable';
import BatchListTable from '../allocated-batch-tab/AllocatedBatchTable';

// Custom Hooks
import { useBatchPage } from '../../../hooks/batch/page/useBatchPage';

const BatchPage = ({ currentUser }) => {
    // Hook Utama Halaman Batch
    const {
        reloadTrigger,
        activeTab,
        setActiveTab,
        handleTriggerReload
    } = useBatchPage();

    return (
        <div style={{ padding: '0px 20px 20px 20px', fontFamily: 'sans-serif' }}>
            <Header
                activeTab={activeTab}
                onTabChange={setActiveTab}
                currentUser={currentUser}
                onSuccessSave={handleTriggerReload}
            />

            <div>
                {activeTab === 'summary' && (
                    <OutstandingTable
                        currentUser={currentUser}
                        reloadTrigger={reloadTrigger}
                    />
                )}

                {activeTab === 'mapping' && (
                    <BatchListTable
                        currentUser={currentUser}
                        reloadTrigger={reloadTrigger}
                        onRefreshAll={handleTriggerReload}
                    />
                )}
            </div>
        </div>
    );
};

export default BatchPage;
