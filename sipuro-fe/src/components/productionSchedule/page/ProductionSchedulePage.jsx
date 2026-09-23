import { useState } from 'react';
import PORequirementTab from '../poRequirement/PORequirementTab';
import ProductionPlanTab from '../productionPlan/ProductionPlanTab';

const ProductionSchedulePage = () => {
    // State untuk mengontrol tab aktif
    const [activeTab, setActiveTab] = useState('PRODUCTION_PLAN');

    return (
        <div style={{ padding: '0px 20px 20px 20px', fontFamily: 'sans-serif' }}>
            {/* Header Sub-Tab Navigation (Disamakan dengan Batch Header) */}
            <div style={{
                display: 'flex',
                borderBottom: '2px solid #dee2e6',
                marginBottom: '20px'
            }}>
                <button
                    type="button"
                    onClick={() => setActiveTab('PRODUCTION_PLAN')}
                    style={{
                        padding: '12px 20px',
                        border: 'none',
                        background: 'none',
                        cursor: 'pointer',
                        fontWeight: 'bold',
                        fontSize: '14px',
                        borderBottom: activeTab === 'PRODUCTION_PLAN' ? '3px solid #0d6efd' : '3px solid transparent',
                        color: activeTab === 'PRODUCTION_PLAN' ? '#0d6efd' : '#6c757d'
                    }}
                >
                    Production Plan
                </button>
                <button
                    type="button"
                    onClick={() => setActiveTab('PO_REQUIREMENT')}
                    style={{
                        padding: '12px 20px',
                        border: 'none',
                        background: 'none',
                        cursor: 'pointer',
                        fontWeight: 'bold',
                        fontSize: '14px',
                        borderBottom: activeTab === 'PO_REQUIREMENT' ? '3px solid #0d6efd' : '3px solid transparent',
                        color: activeTab === 'PO_REQUIREMENT' ? '#0d6efd' : '#6c757d'
                    }}
                >
                    PO Requirement
                </button>
            </div>

            {/* Content Tab Rendering */}
            <div>
                {activeTab === 'PO_REQUIREMENT' && <PORequirementTab />}
                {activeTab === 'PRODUCTION_PLAN' && <ProductionPlanTab />}
            </div>
        </div>
    );
};

export default ProductionSchedulePage;
