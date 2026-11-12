// Lightweight UI translations for the admin web: English, Telugu (te), Hindi (hi).
// t('English text') returns the text in the selected language and falls back to
// English for anything not yet translated. Language is saved per browser.
import { useEffect, useState } from 'react';

const KEY = 'orison_lang';
export const LANGUAGES = { en: 'English', te: 'తెలుగు', hi: 'हिन्दी' };

export const getLang = () => { try { return localStorage.getItem(KEY) || 'en'; } catch { return 'en'; } };
export const setLang = (code) => {
  try { localStorage.setItem(KEY, code); } catch { /* ignore */ }
  document.documentElement.lang = code;
  window.dispatchEvent(new Event('orison-lang'));
};

/** Re-render the calling component when the language changes. */
export const useLang = () => {
  const [lang, set] = useState(getLang);
  useEffect(() => {
    const on = () => set(getLang());
    window.addEventListener('orison-lang', on);
    return () => window.removeEventListener('orison-lang', on);
  }, []);
  return lang;
};

export const t = (en) => {
  const lang = getLang();
  if (lang === 'en') return en;
  const row = D[en];
  return row ? row[lang === 'te' ? 0 : 1] : en;
};

// English: [Telugu, Hindi]
const D = {
  'Dashboard': ['డాష్‌బోర్డ్', 'डैशबोर्ड'],
  'Student Management': ['విద్యార్థుల నిర్వహణ', 'छात्र प्रबंधन'],
  'View Students': ['విద్యార్థులను చూడండి', 'छात्र देखें'],
  'Add Students': ['విద్యార్థులను చేర్చండి', 'छात्र जोड़ें'],
  'Promote Student': ['విద్యార్థి పదోన్నతి', 'छात्र पदोन्नति'],
  'Transfer Student': ['విద్యార్థి బదిలీ', 'छात्र स्थानांतरण'],
  'Student Health Signals': ['విద్యార్థి ఆరోగ్య సూచికలు', 'छात्र स्वास्थ्य संकेत'],
  'Student Support Plans': ['విద్యార్థి సహాయ ప్రణాళికలు', 'छात्र सहायता योजनाएँ'],
  'Admissions Management': ['ప్రవేశాల నిర్వహణ', 'प्रवेश प्रबंधन'],
  'Enquiries & Visits': ['విచారణలు & సందర్శనలు', 'पूछताछ और विज़िट'],
  'Admission Processing': ['ప్రవేశ ప్రక్రియ', 'प्रवेश प्रक्रिया'],
  'Academics Management': ['అకడమిక్స్ నిర్వహణ', 'शैक्षणिक प्रबंधन'],
  'Academic Setup': ['అకడమిక్ సెటప్', 'शैक्षणिक सेटअप'],
  'Academic Action Center': ['అకడమిక్ చర్యల కేంద్రం', 'शैक्षणिक कार्य केंद्र'],
  'Curriculum & Syllabus': ['పాఠ్యప్రణాళిక & సిలబస్', 'पाठ्यक्रम और सिलेबस'],
  'Classroom Observations': ['తరగతి పరిశీలనలు', 'कक्षा अवलोकन'],
  'Attendance Management': ['హాజరు నిర్వహణ', 'उपस्थिति प्रबंधन'],
  'Add Attendance': ['హాజరు నమోదు', 'उपस्थिति दर्ज करें'],
  'View Attendance': ['హాజరు చూడండి', 'उपस्थिति देखें'],
  'Attendance Reports': ['హాజరు నివేదికలు', 'उपस्थिति रिपोर्ट'],
  'Exams Management': ['పరీక్షల నిర్వహణ', 'परीक्षा प्रबंधन'],
  'Create Exam': ['పరీక్ష సృష్టించండి', 'परीक्षा बनाएँ'],
  'View Exam': ['పరీక్ష చూడండి', 'परीक्षा देखें'],
  'Marks Management': ['మార్కుల నిర్వహణ', 'अंक प्रबंधन'],
  'Add Marks': ['మార్కులు నమోదు', 'अंक दर्ज करें'],
  'Results': ['ఫలితాలు', 'परिणाम'],
  'Report Card': ['ప్రోగ్రెస్ కార్డ్', 'रिपोर्ट कार्ड'],
  'Hall Tickets': ['హాల్ టిక్కెట్లు', 'प्रवेश पत्र'],
  'Create Hall Ticket': ['హాల్ టిక్కెట్ సృష్టించండి', 'प्रवेश पत्र बनाएँ'],
  'View Hall Tickets': ['హాల్ టిక్కెట్లు చూడండి', 'प्रवेश पत्र देखें'],
  'Homework Management': ['హోంవర్క్ నిర్వహణ', 'गृहकार्य प्रबंधन'],
  'Add Homework': ['హోంవర్క్ ఇవ్వండి', 'गृहकार्य दें'],
  'Homework Reports': ['హోంవర్క్ నివేదికలు', 'गृहकार्य रिपोर्ट'],
  'Timetable Management': ['టైమ్‌టేబుల్ నిర్వహణ', 'समय सारणी प्रबंधन'],
  'Create Timetable': ['టైమ్‌టేబుల్ సృష్టించండి', 'समय सारणी बनाएँ'],
  'View Timetable': ['టైమ్‌టేబుల్ చూడండి', 'समय सारणी देखें'],
  'Timetable Reports': ['టైమ్‌టేబుల్ నివేదికలు', 'समय सारणी रिपोर्ट'],
  'Teachers Management': ['ఉపాధ్యాయుల నిర్వహణ', 'शिक्षक प्रबंधन'],
  'View Teachers': ['ఉపాధ్యాయులను చూడండి', 'शिक्षक देखें'],
  'Add Teacher': ['ఉపాధ్యాయుడిని చేర్చండి', 'शिक्षक जोड़ें'],
  'Assign Teacher': ['ఉపాధ్యాయుడిని కేటాయించండి', 'शिक्षक नियुक्त करें'],
  'View Allocations': ['కేటాయింపులు చూడండి', 'आवंटन देखें'],
  'Staff Management': ['సిబ్బంది నిర్వహణ', 'स्टाफ़ प्रबंधन'],
  'View Staff': ['సిబ్బందిని చూడండి', 'स्टाफ़ देखें'],
  'Add Staff': ['సిబ్బందిని చేర్చండి', 'स्टाफ़ जोड़ें'],
  'Leave Management': ['సెలవుల నిర్వహణ', 'छुट्टी प्रबंधन'],
  'Leave Requests': ['సెలవు అభ్యర్థనలు', 'छुट्टी अनुरोध'],
  'Apply Leave': ['సెలవు దరఖాస్తు', 'छुट्टी का आवेदन'],
  'Fee Management': ['ఫీజు నిర్వహణ', 'फ़ीस प्रबंधन'],
  'Create Fees': ['ఫీజులు సృష్టించండి', 'फ़ीस बनाएँ'],
  'Collect Fee': ['ఫీజు వసూలు', 'फ़ीस जमा करें'],
  'View Collections': ['వసూళ్లు చూడండి', 'संग्रह देखें'],
  'Receipts': ['రశీదులు', 'रसीदें'],
  'Online Payments': ['ఆన్‌లైన్ చెల్లింపులు', 'ऑनलाइन भुगतान'],
  'Fee Control Center': ['ఫీజు నియంత్రణ కేంద్రం', 'फ़ीस नियंत्रण केंद्र'],
  'Collection Intelligence': ['వసూళ్ల విశ్లేషణ', 'संग्रह विश्लेषण'],
  'Expenses Management': ['ఖర్చుల నిర్వహణ', 'व्यय प्रबंधन'],
  'Expense Overview': ['ఖర్చుల సారాంశం', 'व्यय सारांश'],
  'Record Expense': ['ఖర్చు నమోదు', 'व्यय दर्ज करें'],
  'Expense Register': ['ఖర్చుల రిజిస్టర్', 'व्यय रजिस्टर'],
  'Expense Reports': ['ఖర్చుల నివేదికలు', 'व्यय रिपोर्ट'],
  'Purchase & Stock': ['కొనుగోలు & స్టాక్', 'ख़रीद और स्टॉक'],
  'Stock Overview': ['స్టాక్ సారాంశం', 'स्टॉक सारांश'],
  'Buy / Receive Stock': ['స్టాక్ కొనుగోలు / స్వీకరణ', 'स्टॉक ख़रीदें / प्राप्त करें'],
  'Stock Register': ['స్టాక్ రిజిస్టర్', 'स्टॉक रजिस्टर'],
  'Issue to Parent': ['తల్లిదండ్రులకు ఇవ్వండి', 'अभिभावक को दें'],
  'Issue to Teacher / School': ['ఉపాధ్యాయుడికి / పాఠశాలకు ఇవ్వండి', 'शिक्षक / स्कूल को दें'],
  'Inventory Reports': ['స్టాక్ నివేదికలు', 'स्टॉक रिपोर्ट'],
  'Transport Management': ['రవాణా నిర్వహణ', 'परिवहन प्रबंधन'],
  'Transport Overview': ['రవాణా సారాంశం', 'परिवहन सारांश'],
  'Routes & Stops': ['మార్గాలు & స్టాప్‌లు', 'रूट और स्टॉप'],
  'Communications': ['సంప్రదింపులు', 'संचार'],
  'Notifications': ['నోటిఫికేషన్లు', 'सूचनाएँ'],
  'Notification Dashboard': ['నోటిఫికేషన్ డాష్‌బోర్డ్', 'सूचना डैशबोर्ड'],
  'Send Notification': ['నోటిఫికేషన్ పంపండి', 'सूचना भेजें'],
  'Reports': ['నివేదికలు', 'रिपोर्ट'],
  'Visitor Management': ['సందర్శకుల నిర్వహణ', 'आगंतुक प्रबंधन'],
  'Visitor Overview': ['సందర్శకుల సారాంశం', 'आगंतुक सारांश'],
  'Register Visitor': ['సందర్శకుడిని నమోదు చేయండి', 'आगंतुक दर्ज करें'],
  'Visitor Log': ['సందర్శకుల లాగ్', 'आगंतुक लॉग'],
  'Question Bank': ['ప్రశ్నల బ్యాంక్', 'प्रश्न बैंक'],
  'HR & Payroll': ['HR & జీతాలు', 'HR और वेतन'],
  'Biometric Management': ['బయోమెట్రిక్ నిర్వహణ', 'बायोमेट्रिक प्रबंधन'],
  'Multi Branch Management': ['బహుళ శాఖల నిర్వహణ', 'बहु-शाखा प्रबंधन'],
  'Network Overview': ['నెట్‌వర్క్ సారాంశం', 'नेटवर्क सारांश'],
  'Branch Directory': ['శాఖల జాబితా', 'शाखा निर्देशिका'],
  'Consolidated Reports': ['సమగ్ర నివేదికలు', 'समेकित रिपोर्ट'],
  'Parent App Center': ['తల్లిదండ్రుల యాప్ కేంద్రం', 'अभिभावक ऐप केंद्र'],
  'Compliance (APAAR · UDISE+)': ['నిబంధనలు (APAAR · UDISE+)', 'अनुपालन (APAAR · UDISE+)'],
  'Certificates': ['సర్టిఫికెట్లు', 'प्रमाणपत्र'],
  'ID Cards': ['ID కార్డులు', 'पहचान पत्र'],
  'Consent Forms': ['అనుమతి పత్రాలు', 'सहमति पत्र'],
  'Library': ['గ్రంథాలయం', 'पुस्तकालय'],
  'Book Catalogue': ['పుస్తకాల జాబితా', 'पुस्तक सूची'],
  'Issue & Return': ['ఇవ్వడం & తిరిగి తీసుకోవడం', 'जारी करें और वापसी'],
  'Hostel': ['హాస్టల్', 'छात्रावास'],
  'Events & Gallery': ['కార్యక్రమాలు & గ్యాలరీ', 'कार्यक्रम और गैलरी'],
  'Surveys & Feedback': ['సర్వేలు & అభిప్రాయాలు', 'सर्वे और प्रतिक्रिया'],
  'Settings': ['సెట్టింగ్‌లు', 'सेटिंग्स'],
  // Shell
  'School workspace': ['పాఠశాల వర్క్‌స్పేస్', 'स्कूल वर्कस्पेस'],
  'Sign out securely': ['సురక్షితంగా సైన్ అవుట్', 'सुरक्षित साइन आउट'],
  'Collapse menu': ['మెనూ చిన్నది చేయండి', 'मेनू छोटा करें'],
  'Dark mode': ['డార్క్ మోడ్', 'डार्क मोड'],
  'Light mode': ['లైట్ మోడ్', 'लाइट मोड'],
  'Language': ['భాష', 'भाषा'],
  'Welcome back': ['తిరిగి స్వాగతం', 'फिर से स्वागत है'],
  'Quick actions': ['త్వరిత చర్యలు', 'त्वरित कार्य'],
  'Go to': ['వెళ్ళండి', 'जाएँ'],
  'Students': ['విద్యార్థులు', 'छात्र'],
  'Search screens, actions or a student name…': ['స్క్రీన్‌లు, చర్యలు లేదా విద్యార్థి పేరు వెతకండి…', 'स्क्रीन, कार्य या छात्र का नाम खोजें…'],
  'Cancel': ['రద్దు', 'रद्द करें'],
  'Confirm': ['నిర్ధారించండి', 'पुष्टि करें'],
  'Continue': ['కొనసాగించండి', 'जारी रखें'],
  'Please confirm': ['దయచేసి నిర్ధారించండి', 'कृपया पुष्टि करें'],
  'Please add details': ['దయచేసి వివరాలు ఇవ్వండి', 'कृपया विवरण दें'],
};
