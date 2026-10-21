import Header from './Header';
import AllocatedBatchTable from '../allocated-batch/AllocatedBatchTable';

// Custom Hooks
import { useBatchPage } from '../../../hooks/batch/page/useBatchPage';

const BatchPage = ({ currentUser }) => {
    // Hook Utama Halaman Batch
    const { reloadTrigger, handleTriggerReload } = useBatchPage();

    return (
        <div style={{ padding: '0px 20px 20px 20px', fontFamily: 'sans-serif' }}>
            <Header
                currentUser={currentUser}
                onSuccessSave={handleTriggerReload}
            />

            <div>
                <AllocatedBatchTable
                    currentUser={currentUser}
                    reloadTrigger={reloadTrigger}
                    onRefreshAll={handleTriggerReload}
                />
            </div>
        </div>
    );
};

export default BatchPage;
