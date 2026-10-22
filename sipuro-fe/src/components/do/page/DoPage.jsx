import DoTable from '../allocated-do/DoTable';
import DoHeader from './DoHeader';

// Custom Hooks
import { useDoPage } from '../../../hooks/do/page/useDoPage';

const DoPage = ({ currentUser }) => {
    const {
        reloadTrigger,
        handleTriggerReload
    } = useDoPage();

    return (
        <div style={{ padding: '0px 20px 20px 20px', fontFamily: 'sans-serif' }}>
            <DoHeader
                currentUser={currentUser}
                onSuccessSave={handleTriggerReload}
            />

            <DoTable
                currentUser={currentUser}
                reloadTrigger={reloadTrigger}
            />
        </div>
    );
}

export default DoPage;
