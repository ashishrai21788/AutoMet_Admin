/** Indian states and union territories by GST state code (the first two digits of a GSTIN). Keep in sync with AutoMet_Webend_Apis/lib/gst.js. */
export const GST_STATES: Record<string, string> = {
  '01': 'Jammu and Kashmir', '02': 'Himachal Pradesh', '03': 'Punjab', '04': 'Chandigarh', '05': 'Uttarakhand', '06': 'Haryana', '07': 'Delhi',
  '08': 'Rajasthan', '09': 'Uttar Pradesh', '10': 'Bihar', '11': 'Sikkim', '12': 'Arunachal Pradesh', '13': 'Nagaland', '14': 'Manipur', '15': 'Mizoram',
  '16': 'Tripura', '17': 'Meghalaya', '18': 'Assam', '19': 'West Bengal', '20': 'Jharkhand', '21': 'Odisha', '22': 'Chhattisgarh', '23': 'Madhya Pradesh',
  '24': 'Gujarat', '26': 'Dadra and Nagar Haveli and Daman and Diu', '27': 'Maharashtra', '29': 'Karnataka', '30': 'Goa', '31': 'Lakshadweep', '32': 'Kerala',
  '33': 'Tamil Nadu', '34': 'Puducherry', '35': 'Andaman and Nicobar Islands', '36': 'Telangana', '37': 'Andhra Pradesh', '38': 'Ladakh', '97': 'Other Territory',
}

const GSTIN_RE = /^(\d{2})[A-Z]{5}\d{4}[A-Z][A-Z\d]Z[A-Z\d]$/

export const isGstin = (v: string) => { const m = GSTIN_RE.exec(v.trim().toUpperCase()); return !!m && m[1] in GST_STATES }
export const stateOfGstin = (v: string) => (isGstin(v) ? v.trim().toUpperCase().slice(0, 2) : '')
