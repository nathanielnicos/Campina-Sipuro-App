import { useEffect, useState, useRef } from 'react';
import html2pdf from 'html2pdf.js';
import { fetchPODetail, fetchCompanyProfile } from '../../../services/poApi';
import { getWibTimestamp } from '../../../utils/dateHelper';

export const usePdfModal = (poId) => {
    const [poData, setPoData] = useState(null);
    const [seller, setSeller] = useState(null);
    const [loading, setLoading] = useState(true);
    const pdfContentRef = useRef(null);

    useEffect(() => {
        const loadData = async () => {
            try {
                setLoading(true);
                const [poRes, companyRes] = await Promise.all([
                    fetchPODetail(poId),
                    fetchCompanyProfile()
                ]);

                if (poRes.success) {
                    setPoData(poRes.data);
                }
                if (companyRes.success && companyRes.data) {
                    setSeller(companyRes.data);
                }
            } catch (err) {
                console.error('Failed to fetch PDF data:', err);
            } finally {
                setLoading(false);
            }
        };

        if (poId) {
            loadData();
        }
    }, [poId]);

    const handleDownloadPdf = () => {
        const element = pdfContentRef.current;
        if (!element) return;

        const timestamp = getWibTimestamp();
        const rawPoNumber = poData?.header?.po_number || 'Document';
        const safePoNumber = rawPoNumber.replace(/\//g, '-');

        const options = {
            margin: 10,
            filename: `${safePoNumber}_${timestamp}.pdf`,
            image: { type: 'jpeg', quality: 0.98 },
            html2canvas: { scale: 2, useCORS: true },
            jsPDF: { unit: 'mm', format: 'a4', orientation: 'portrait' }
        };

        html2pdf().set(options).from(element).save();
    };

    const ppnPercentNum = poData?.header?.ppn_percent
        ? Number(poData.header.ppn_percent)
        : (seller?.ppn_percent ? Number(seller.ppn_percent) : 0);

    return {
        poData,
        seller,
        loading,
        pdfContentRef,
        ppnPercentNum,
        handleDownloadPdf
    };
};
