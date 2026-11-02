import React from 'react';

const ProductCell = ({ code, name }) => (
    <>
        <div style={{ fontWeight: 'bold', color: '#212529' }}>{code}</div>
        <div style={{ fontSize: '12px', color: '#6c757d', marginTop: '2px' }}>{name}</div>
    </>
);

export default ProductCell;
