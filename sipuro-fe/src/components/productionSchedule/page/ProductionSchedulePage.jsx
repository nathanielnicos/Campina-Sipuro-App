import { useState } from 'react';
import PORequirementTab from '../poRequirement/PORequirementTab';
import ProductionPlanTab from '../productionPlan/ProductionPlanTab';

const ProductionSchedulePage = () => {
    // State untuk mengontrol tab aktif
    const [activeTab, setActiveTab] = useState('PRODUCTION_PLAN');

    return (
        <div style={{ backgroundColor: '#f8f9fa', minHeight: '100vh', padding: '0px 24px 24px 24px' }}>
            {/* Header Sub-Tab Navigation */}
            <div style={{
                display: 'flex',
                gap: '8px',
                borderBottom: '2px solid #dee2e6',
                marginBottom: '16px',
                backgroundColor: '#fff',
                padding: '12px 16px 0px 16px',
                borderRadius: '8px 8px 0 0'
            }}>
                <button
                    type="button"
                    onClick={() => setActiveTab('PRODUCTION_PLAN')}
                    style={{
                        padding: '10px 20px',
                        border: 'none',
                        borderBottom: activeTab === 'PRODUCTION_PLAN' ? '3px solid #0d6efd' : '3px solid transparent',
                        backgroundColor: 'transparent',
                        color: activeTab === 'PRODUCTION_PLAN' ? '#0d6efd' : '#6c757d',
                        fontWeight: activeTab === 'PRODUCTION_PLAN' ? '700' : '500',
                        fontSize: '14px',
                        cursor: 'pointer',
                        transition: 'all 0.2s ease-in-out'
                    }}
                >
                    Production Plan
                </button>
                <button
                    type="button"
                    onClick={() => setActiveTab('PO_REQUIREMENT')}
                    style={{
                        padding: '10px 20px',
                        border: 'none',
                        borderBottom: activeTab === 'PO_REQUIREMENT' ? '3px solid #0d6efd' : '3px solid transparent',
                        backgroundColor: 'transparent',
                        color: activeTab === 'PO_REQUIREMENT' ? '#0d6efd' : '#6c757d',
                        fontWeight: activeTab === 'PO_REQUIREMENT' ? '700' : '500',
                        fontSize: '14px',
                        cursor: 'pointer',
                        transition: 'all 0.2s ease-in-out'
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
