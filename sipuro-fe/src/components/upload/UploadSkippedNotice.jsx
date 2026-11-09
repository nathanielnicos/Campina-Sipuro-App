// Pemberitahuan di preview upload: baris Excel yang dilewati karena Trans Type-nya belum terdaftar atau nonaktif.
// Tanpa ini baris tersebut hilang tanpa info. Tidak menampilkan apa pun bila tidak ada baris yang dilewati.
const UploadSkippedNotice = ({ skippedRowCount = 0, skippedTransTypes = [] }) => {
    if (!skippedRowCount) return null;

    return (
        <div
            role="alert"
            style={{
                backgroundColor: '#fff3cd',
                color: '#664d03',
                border: '1px solid #ffecb5',
                padding: '10px 14px',
                borderRadius: '6px',
                marginBottom: '16px',
                fontSize: '13px'
            }}
        >
            <strong>
                {skippedRowCount} row(s) in the file were not read because their Trans Type is not registered or not active.
            </strong>
            <ul style={{ margin: '6px 0 6px 18px', padding: 0 }}>
                {skippedTransTypes.map((item) => {
                    const listed = item.sampleRows || [];
                    const more = item.rowCount - listed.length;
                    return (
                        <li key={item.transType}>
                            "{item.transType}" - {item.rowCount} row(s), Excel row {listed.join(', ')}
                            {more > 0 ? ` and ${more} more` : ''}
                        </li>
                    );
                })}
            </ul>
            Register or activate the Trans Type in Setting &gt; Upload Trans Types, then upload the file again.
        </div>
    );
};

export default UploadSkippedNotice;
