import React, { useState } from 'react';
import SalesInvoiceHeader from './SalesInvoiceHeader';
import SalesInvoiceTable from '../table/SalesInvoiceTable';

const SalesInvoicePage = ({ currentUser }) => {
    const [reloadTrigger, setReloadTrigger] = useState(0);

    const handleTriggerReload = () => {
        setReloadTrigger((prev) => prev + 1);
    };

    return (
        <div style={{ padding: '0px 20px 20px 20px', fontFamily: 'sans-serif' }}>
            <SalesInvoiceHeader currentUser={currentUser} onSuccessSave={handleTriggerReload} />
            <SalesInvoiceTable currentUser={currentUser} reloadTrigger={reloadTrigger} />
        </div>
    );
};

export default SalesInvoicePage;
