import Header from './Header';
import UnbatchedTable from '../unbatched-tab/UnbatchedTable';
import BatchListTable from '../batch-list-tab/BatchListTable';
import OverproductionTable from '../overproduction-tab/OverproductionTable';

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
                    <UnbatchedTable
                        currentUser={currentUser}
                        reloadTrigger={reloadTrigger}
                        onRefreshAll={handleTriggerReload}
                    />
                )}

                {activeTab === 'mapping' && (
                    <BatchListTable
                        currentUser={currentUser}
                        reloadTrigger={reloadTrigger}
                        onRefreshAll={handleTriggerReload}
                    />
                )}

                {activeTab === 'unallocated' && (
                    <OverproductionTable
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
