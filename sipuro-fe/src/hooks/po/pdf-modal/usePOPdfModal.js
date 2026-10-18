import { useEffect, useState, useRef } from 'react';
import { fetchPODetail, fetchCompanyProfile } from '../../../services/poApi';
import { getWibTimestamp } from '../../../utils/dateHelper';
import { useGlobalModal } from '../../../context/ModalContext';

export const usePOPdfModal = (poId) => {
    const [poData, setPoData] = useState(null);
    const [seller, setSeller] = useState(null);
    const [loading, setLoading] = useState(true);
    const [downloading, setDownloading] = useState(false);
    const { showAlert } = useGlobalModal();
    const pdfContentRef = useRef(null);

    useEffect(() => {
        // Mencegah pembaruan state jika modal ditutup / PO berganti sebelum permintaan selesai
        let cancelled = false;

        const loadData = async () => {
            try {
                setLoading(true);
                const [poRes, companyRes] = await Promise.all([
                    fetchPODetail(poId),
                    fetchCompanyProfile()
                ]);

                if (cancelled) return;

                if (poRes.success) {
                    setPoData(poRes.data);
                }
                if (companyRes.success && companyRes.data) {
                    setSeller(companyRes.data);
                }
            } catch (err) {
                console.error('Failed to fetch PDF data:', err);
            } finally {
                if (!cancelled) setLoading(false);
            }
        };

        if (poId) {
            loadData();
        }

        return () => {
            cancelled = true;
        };
    }, [poId]);

    const handleDownloadPdf = async () => {
        const element = pdfContentRef.current;
        if (!element || downloading) return;

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

        try {
            setDownloading(true);
            // Pustaka PDF cukup besar, jadi hanya dimuat saat tombol Download ditekan
            // (tidak ikut memperberat pemuatan halaman awal).
            const { default: html2pdf } = await import('html2pdf.js');
            await html2pdf().set(options).from(element).save();
        } catch (err) {
            console.error('Failed to generate PDF:', err);
            showAlert({
                type: 'error',
                title: 'Download Failed',
                message: 'Failed to generate the PDF file. Please try again.'
            });
        } finally {
            setDownloading(false);
        }
    };

    // PPN yang tersimpan di PO dipakai lebih dulu (termasuk 0%); tarif perusahaan hanya sebagai cadangan.
    const headerPpn = poData?.header?.ppn_percent;
    const ppnPercentNum = headerPpn !== undefined && headerPpn !== null
        ? Number(headerPpn)
        : (seller?.ppn_percent ? Number(seller.ppn_percent) : 0);

    return {
        poData,
        seller,
        loading,
        downloading,
        pdfContentRef,
        ppnPercentNum,
        handleDownloadPdf
    };
};
