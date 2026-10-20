import ProductionLotHeader from './ProductionLotHeader';

// Custom Hooks
import { useProductionLotPage } from '../../../hooks/production-lot/page/useProductionLotPage';

const ProductionLotPage = ({ currentUser }) => {
    const {
        // reloadTrigger,
        handleTriggerReload
    } = useProductionLotPage();

    return (
        <div style={{ padding: '0px 20px 20px 20px', fontFamily: 'sans-serif' }}>
            <ProductionLotHeader
                currentUser={currentUser}
                onSuccessSave={handleTriggerReload}
            />

            {/* <ProductionLotList
                currentUser={currentUser}
                reloadTrigger={reloadTrigger}
                onRefreshAll={handleTriggerReload}
            /> */}
        </div>
    );
}

export default ProductionLotPage;
