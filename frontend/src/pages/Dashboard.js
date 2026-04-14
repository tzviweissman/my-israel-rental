import React, { useState, useEffect, useContext } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import axios from 'axios';
import { API, AuthContext } from '../App';
import { Plus, Edit, Trash2, Eye, MessageCircle, Upload, X, Image, Film, CalendarSync, Link2, Copy, Check, RefreshCw } from 'lucide-react';
import { toast } from 'sonner';

const Dashboard = () => {
  const { t } = useTranslation();
  const { user, token } = useContext(AuthContext);
  const navigate = useNavigate();
  const [properties, setProperties] = useState([]);
  const [bookings, setBookings] = useState([]);
  const [showAddProperty, setShowAddProperty] = useState(false);
  const [uploadedFiles, setUploadedFiles] = useState([]);
  const [uploading, setUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [editingPropertyId, setEditingPropertyId] = useState(null);
  const [icalPanel, setIcalPanel] = useState(null);
  const [icalUrl, setIcalUrl] = useState('');
  const [icalSyncing, setIcalSyncing] = useState(false);
  const [icalData, setIcalData] = useState({});
  const [copiedExport, setCopiedExport] = useState(false);
  const [propertyForm, setPropertyForm] = useState({
    title: '',
    description: '',
    rental_type: 'long-term',
    property_type: 'apartment',
    bedrooms: 1,
    bathrooms: 1,
    area: '',
    address: '',
    square_meters: '',
    porch_square_meters: '',
    floor: 1,
    has_elevator: false,
    is_shabbat_elevator: false,
    is_tama: false,
    has_agent_fee: false,
    agent_fee_price: '',
    agent_fee_currency: 'ILS',
    porches: 0,
    sukkah_compatible: false,
    condition: 'good',
    furniture_option: 'no_furniture',
    amenities: [],
    monthly_price: '',
    nightly_price: '',
    currency: 'ILS',
    images: []
  });

  useEffect(() => {
    if (user) {
      fetchProperties();
      fetchBookings();
    }
  }, [user]);

  const fetchProperties = async () => {
    try {
      const response = await axios.get(`${API}/properties?owner_id=${user.id}`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      setProperties(response.data);
    } catch (error) {
      console.error('Failed to fetch properties', error);
    }
  };

  const fetchBookings = async () => {
    try {
      const response = await axios.get(`${API}/bookings`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      setBookings(response.data);
    } catch (error) {
      console.error('Failed to fetch bookings', error);
    }
  };

  const handleFileUpload = async (e) => {
    const files = Array.from(e.target.files);
    if (files.length === 0) return;

    setUploading(true);
    setUploadProgress(0);
    const uploaded = [];
    
    for (let i = 0; i < files.length; i++) {
      const formData = new FormData();
      formData.append('file', files[i]);
      try {
        const res = await axios.post(`${API}/upload`, formData, {
          headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'multipart/form-data' }
        });
        uploaded.push({ ...res.data, original_name: files[i].name });
      } catch (err) {
        toast.error(`Failed to upload ${files[i].name}: ${err.response?.data?.detail || 'Error'}`);
      }
      setUploadProgress(Math.round(((i + 1) / files.length) * 100));
    }

    const newImages = uploaded.filter(f => f.file_type === 'image').map(f => f.url);
    const newVideos = uploaded.filter(f => f.file_type === 'video').map(f => f.url);
    setUploadedFiles(prev => [...prev, ...uploaded]);
    setPropertyForm(prev => ({
      ...prev,
      images: [...prev.images, ...newImages],
      videos: [...(prev.videos || []), ...newVideos]
    }));
    setUploading(false);
    if (uploaded.length > 0) toast.success(`${uploaded.length} file(s) uploaded`);
  };

  const removeUploadedFile = async (fileToRemove) => {
    try {
      await axios.delete(`${API}/upload/${fileToRemove.filename}`, {
        headers: { Authorization: `Bearer ${token}` }
      });
    } catch (e) { /* ignore */ }
    setUploadedFiles(prev => prev.filter(f => f.filename !== fileToRemove.filename));
    setPropertyForm(prev => ({
      ...prev,
      images: prev.images.filter(url => url !== fileToRemove.url),
      videos: (prev.videos || []).filter(url => url !== fileToRemove.url)
    }));
  };

  const startEditProperty = (property) => {
    setPropertyForm({
      title: property.title || '',
      description: property.description || '',
      rental_type: property.rental_type || 'long-term',
      property_type: property.property_type || 'apartment',
      bedrooms: property.bedrooms || 1,
      bathrooms: property.bathrooms || 1,
      area: property.area || '',
      address: property.address || '',
      square_meters: property.square_meters || '',
      porch_square_meters: property.porch_square_meters || '',
      floor: property.floor || 1,
      has_elevator: property.has_elevator || false,
      is_shabbat_elevator: property.is_shabbat_elevator || false,
      is_tama: property.is_tama || false,
      has_agent_fee: property.has_agent_fee || false,
      agent_fee_price: property.agent_fee_price || '',
      agent_fee_currency: property.agent_fee_currency || 'ILS',
      porches: property.porches || 0,
      sukkah_compatible: property.sukkah_compatible || false,
      condition: property.condition || 'good',
      furniture_option: property.furniture_option || 'no_furniture',
      amenities: property.amenities || [],
      monthly_price: property.monthly_price || '',
      nightly_price: property.nightly_price || '',
      currency: property.currency || 'ILS',
      images: property.images || [],
      videos: property.videos || []
    });
    setUploadedFiles((property.images || []).map((url, i) => ({
      url, file_type: 'image', filename: url.split('/').pop(), original_name: `Image ${i + 1}`
    })).concat((property.videos || []).map((url, i) => ({
      url, file_type: 'video', filename: url.split('/').pop(), original_name: `Video ${i + 1}`
    }))));
    setEditingPropertyId(property.id);
    setShowAddProperty(true);
  };

  const handleAddProperty = async (e) => {
    e.preventDefault();
    try {
      // Convert empty strings to null for optional numeric fields
      const cleanedForm = {
        ...propertyForm,
        square_meters: propertyForm.square_meters === '' ? null : propertyForm.square_meters,
        porch_square_meters: propertyForm.porch_square_meters === '' ? null : propertyForm.porch_square_meters,
        agent_fee_price: propertyForm.agent_fee_price === '' ? null : propertyForm.agent_fee_price,
        monthly_price: propertyForm.monthly_price === '' ? null : propertyForm.monthly_price,
        nightly_price: propertyForm.nightly_price === '' ? null : propertyForm.nightly_price,
      };
      if (editingPropertyId) {
        await axios.put(`${API}/properties/${editingPropertyId}`, cleanedForm, {
          headers: { Authorization: `Bearer ${token}` }
        });
        toast.success('Property updated successfully!');
      } else {
        await axios.post(`${API}/properties`, cleanedForm, {
          headers: { Authorization: `Bearer ${token}` }
        });
        toast.success('Property added successfully!');
      }
      setShowAddProperty(false);
      setEditingPropertyId(null);
      fetchProperties();
      setPropertyForm({
        title: '',
        description: '',
        rental_type: 'long-term',
        property_type: 'apartment',
        bedrooms: 1,
        bathrooms: 1,
        area: '',
        address: '',
        square_meters: '',
    porch_square_meters: '',
        floor: 1,
        has_elevator: false,
        is_shabbat_elevator: false,
        is_tama: false,
        has_agent_fee: false,
        agent_fee_price: '',
        agent_fee_currency: 'ILS',
        porches: 0,
        sukkah_compatible: false,
        condition: 'good',
        furniture_option: 'no_furniture',
        amenities: [],
        monthly_price: '',
        nightly_price: '',
        currency: 'ILS',
        images: [],
        videos: []
      });
      setUploadedFiles([]);
    } catch (error) {
      toast.error('Failed to add property');
    }
  };

  const handleDeleteProperty = async (propertyId) => {
    if (!window.confirm('Are you sure you want to delete this property?')) return;

    try {
      await axios.delete(`${API}/properties/${propertyId}`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      toast.success('Property deleted successfully!');
      fetchProperties();
    } catch (error) {
      toast.error('Failed to delete property');
    }
  };

  const getShareableLink = () => {
    return `${window.location.origin}/manager/${user.id}`;
  };

  const copyShareableLink = async () => {
    const link = getShareableLink();
    try {
      await navigator.clipboard.writeText(link);
      toast.success('Link copied to clipboard!');
    } catch {
      const textarea = document.createElement('textarea');
      textarea.value = link;
      document.body.appendChild(textarea);
      textarea.select();
      document.execCommand('copy');
      document.body.removeChild(textarea);
      toast.success('Link copied to clipboard!');
    }
  };

  const openIcalPanel = async (propertyId) => {
    setIcalPanel(icalPanel === propertyId ? null : propertyId);
    setIcalUrl('');
    setCopiedExport(false);
    if (icalPanel !== propertyId) {
      try {
        const res = await axios.get(`${API}/properties/${propertyId}/blocked-dates`);
        setIcalData(prev => ({ ...prev, [propertyId]: res.data }));
      } catch (e) {}
    }
  };

  const addIcalUrl = async (propertyId) => {
    if (!icalUrl.trim()) return;
    setIcalSyncing(true);
    try {
      await axios.post(`${API}/properties/${propertyId}/ical`, { url: icalUrl.trim() }, { headers: { Authorization: `Bearer ${token}` } });
      toast.success(t('property.ical.copied') || 'iCal feed added!');
      setIcalUrl('');
      const res = await axios.get(`${API}/properties/${propertyId}/blocked-dates`);
      setIcalData(prev => ({ ...prev, [propertyId]: res.data }));
      fetchProperties();
    } catch (e) {
      toast.error(e.response?.data?.detail || 'Failed to add iCal feed');
    }
    setIcalSyncing(false);
  };

  const removeIcalUrl = async (propertyId, url) => {
    try {
      await axios.delete(`${API}/properties/${propertyId}/ical`, { data: { url }, headers: { Authorization: `Bearer ${token}` } });
      toast.success('iCal feed removed');
      const res = await axios.get(`${API}/properties/${propertyId}/blocked-dates`);
      setIcalData(prev => ({ ...prev, [propertyId]: res.data }));
      fetchProperties();
    } catch (e) {
      toast.error('Failed to remove iCal feed');
    }
  };

  const manualSync = async (propertyId) => {
    setIcalSyncing(true);
    try {
      await axios.post(`${API}/properties/${propertyId}/ical-sync`, {}, { headers: { Authorization: `Bearer ${token}` } });
      const res = await axios.get(`${API}/properties/${propertyId}/blocked-dates`);
      setIcalData(prev => ({ ...prev, [propertyId]: res.data }));
      toast.success('Sync complete');
    } catch (e) {
      toast.error('Sync failed');
    }
    setIcalSyncing(false);
  };

  const copyExportUrl = async (propertyId) => {
    const url = `${API.replace('/api', '')}/api/properties/${propertyId}/ical-export`;
    try {
      await navigator.clipboard.writeText(url);
    } catch {
      const textarea = document.createElement('textarea');
      textarea.value = url;
      document.body.appendChild(textarea);
      textarea.select();
      document.execCommand('copy');
      document.body.removeChild(textarea);
    }
    setCopiedExport(true);
    setTimeout(() => setCopiedExport(false), 2000);
  };

  return (
    <div className="min-h-screen" data-testid="dashboard-page">
      <div className="max-w-7xl mx-auto px-6 pt-20 pb-12">
        <div className="flex items-center justify-between mb-8">
          <h1 className="text-4xl font-bold" style={{ fontFamily: 'Playfair Display' }}>Dashboard</h1>
          {user && user.role !== 'renter' && (
            <button onClick={() => { setEditingPropertyId(null); setUploadedFiles([]); setPropertyForm({ title: '', description: '', rental_type: 'long-term', property_type: 'apartment', bedrooms: 1, bathrooms: 1, area: '', address: '', square_meters: '', floor: 1, has_elevator: false, is_shabbat_elevator: false, is_tama: false, has_agent_fee: false, agent_fee_price: '', agent_fee_currency: 'ILS', porches: 0, sukkah_compatible: false, condition: 'good', furniture_option: 'no_furniture', amenities: [], monthly_price: '', nightly_price: '', currency: 'ILS', images: [], videos: [] }); setShowAddProperty(true); }} className="primary-btn flex items-center gap-2" data-testid="add-property-button">
              <Plus size={20} />
              {t('dashboard.addProperty')}
            </button>
          )}
        </div>

        {user && user.role !== 'renter' && (
          <div className="bg-white p-6 rounded-2xl border border-[#E5E5E5] mb-8" data-testid="manager-page-section">
            <h2 className="text-xl font-bold mb-4">Your Manager Page</h2>
            <p className="text-gray-600 mb-4">Share this link with potential renters to show all your properties:</p>
            <div className="flex gap-2">
              <input
                type="text"
                value={getShareableLink()}
                readOnly
                className="flex-1 px-4 py-2 rounded-lg border border-[#E5E5E5] bg-gray-50"
                data-testid="shareable-link"
              />
              <button onClick={copyShareableLink} className="secondary-btn" data-testid="copy-link-button">
                Copy Link
              </button>
            </div>
          </div>
        )}

        {showAddProperty && (
          <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-6" data-testid="add-property-modal">
            <div className="bg-white rounded-2xl p-8 max-w-4xl w-full max-h-[90vh] overflow-y-auto">
              <h2 className="text-3xl font-bold mb-6" style={{ fontFamily: 'Playfair Display' }}>{editingPropertyId ? t('dashboard.editProperty') : t('dashboard.addNewProperty')}</h2>
              <form onSubmit={handleAddProperty} className="space-y-6">
                <div>
                  <label className="block text-sm font-medium mb-2">Title</label>
                  <input
                    type="text"
                    value={propertyForm.title}
                    onChange={(e) => setPropertyForm({ ...propertyForm, title: e.target.value })}
                    className="w-full px-4 py-2 rounded-lg border border-[#E5E5E5] focus:outline-none focus:ring-2 focus:ring-[#1E6A6A]/50"
                    required
                    data-testid="property-title-input"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium mb-2">Description</label>
                  <textarea
                    value={propertyForm.description}
                    onChange={(e) => setPropertyForm({ ...propertyForm, description: e.target.value })}
                    rows="4"
                    className="w-full px-4 py-2 rounded-lg border border-[#E5E5E5] focus:outline-none focus:ring-2 focus:ring-[#1E6A6A]/50"
                    data-testid="property-description-input"
                  ></textarea>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div>
                    <label className="block text-sm font-medium mb-2">{t('property.rentalType')}</label>
                    <select
                      value={propertyForm.rental_type}
                      onChange={(e) => setPropertyForm({ ...propertyForm, rental_type: e.target.value })}
                      className="w-full px-4 py-2 rounded-lg border border-[#E5E5E5] focus:outline-none focus:ring-2 focus:ring-[#1E6A6A]/50"
                      data-testid="property-rental-type-select"
                    >
                      <option value="long-term">{t('property.longTerm')}</option>
                      <option value="short-term">{t('property.shortTerm')}</option>
                      <option value="vacation">{t('property.vacationType')}</option>
                      <option value="storage">{t('property.storageType')}</option>
                    </select>
                  </div>
                  {propertyForm.rental_type !== 'storage' && (
                  <div>
                    <label className="block text-sm font-medium mb-2">{t('property.propertyType')}</label>
                    <select
                      value={propertyForm.property_type}
                      onChange={(e) => setPropertyForm({ ...propertyForm, property_type: e.target.value })}
                      className="w-full px-4 py-2 rounded-lg border border-[#E5E5E5] focus:outline-none focus:ring-2 focus:ring-[#1E6A6A]/50"
                      data-testid="property-type-select"
                    >
                      <option value="apartment">{t('property.apartment')}</option>
                      <option value="house">{t('property.house')}</option>
                    </select>
                  </div>
                  )}
                  <div>
                    <label className="block text-sm font-medium mb-2">{t('property.propertyLocation')}</label>
                    <select
                      value={propertyForm.area}
                      onChange={(e) => setPropertyForm({ ...propertyForm, area: e.target.value })}
                      className="w-full px-4 py-2 rounded-lg border border-[#E5E5E5] focus:outline-none focus:ring-2 focus:ring-[#1E6A6A]/50"
                      required
                      data-testid="property-area-input"
                    >
                      <option value="">{t('property.selectNeighborhood')}</option>
                      <optgroup label="Jerusalem">
                        {['Abu Tor','American Colony','Arnona','Arzei HaBira','Baka','Bayit VeGan','Beit HaKerem','Beit Yisrael','Bukharan Quarter','East Talpiot','Ein Kerem','French Hill','Geula','German Colony','Gilo','Givat HaMivtar','Givat Massuah','Givat Mordechai','Givat Ram','Givat Shaul','Greek Colony','Har Nof','Holyland','Jewish Quarter','Katamon','Kerem Avraham','Kiryat HaYovel','Kiryat Menachem','Kiryat Moshe','Kiryat Shmuel','Maalot Dafna','Mahane Yehuda','Malha','Mamilla','Mea Shearim','Mekor Baruch','Mekor Chaim','Mishkenot Shaananim','Musrara','Nachlaot','Neve Yaakov','Old City','Pat','Pisgat Zeev','Ramat Beit HaKerem','Ramat Denya','Ramat Eshkol','Ramat Shlomo','Ramot','Rassco','Rehavia','Romema','Sanhedria','Sanhedria Murhevet','Shaare Hesed','Shmuel HaNavi','Talbiya','Talpiot','Yemin Moshe'].map(n => <option key={n} value={`Jerusalem - ${n}`}>{n}</option>)}
                      </optgroup>
                      <optgroup label="Tel Aviv">
                        {['Afeka','Bavli','City Center (Lev Ha\'Ir)','Florentin','HaTikva','Jaffa (Yafo)','Kerem HaTeimanim','Kikar HaMedina','Kiryat Shalom','Lev Ha\'Ir','Nahalat Binyamin','Neve Ofer','Neve Sha\'anan','Neve Tzedek','New North','Nordau','Old North','Old Jaffa','Park Tzameret','Ramat Aviv','Ramat HaHayal','Ramat HaTayasim','Sarona','Shapira','Tel Baruch','White City','Yad Eliyahu'].map(n => <option key={n} value={`Tel Aviv - ${n}`}>{n}</option>)}
                      </optgroup>
                      <optgroup label="Haifa">
                        {['Ahuza','Bat Galim','Carmel Center','Carmeliya','Denia','French Carmel','German Colony','Hadar HaCarmel','Halisa','Kababir','Kiryat Eliezer','Kiryat Haim','Kiryat Shmuel','Neve David','Neve Sha\'anan','Ramat Almogi','Ramat Eshkol','Romema','Stella Maris','Wadi Nisnas','Western Carmel'].map(n => <option key={n} value={`Haifa - ${n}`}>{n}</option>)}
                      </optgroup>
                      <optgroup label="Beersheba">
                        {['City Center','Dalet','Gimmel','Hey','Nahal Beka','Neve Menachem','Neve Noy','Neve Zeev','Old City','Ramot','Ramot Bet','Tet','Vav'].map(n => <option key={n} value={`Beersheba - ${n}`}>{n}</option>)}
                      </optgroup>
                      <optgroup label="Netanya">
                        {['City Center','Galei Yam','HaAgamim','Ir Yamim','Kiryat Hasharon','Kiryat Nordau','Neve Itamar','Neve Oz','North Netanya','Poleg','Ramat Chen','Ramat Herzl','South Netanya','Umm Khalid'].map(n => <option key={n} value={`Netanya - ${n}`}>{n}</option>)}
                      </optgroup>
                      <optgroup label="Ashdod">
                        {['Alef','Bet','City Center','Dalet','Gimmel','Hey','Marina','Tet','Vav','Yud','Yud Alef','Yud Bet','Yud Zayin','Zayin'].map(n => <option key={n} value={`Ashdod - ${n}`}>{n}</option>)}
                      </optgroup>
                      <optgroup label="Ashkelon">
                        {['Afridar','Barnea','City Center','HaGiborim','Migdalei HaYam','Neve Dekalim','Neve Ilan','Samson Quarter','Shimshon','South Beach','Zion Hills'].map(n => <option key={n} value={`Ashkelon - ${n}`}>{n}</option>)}
                      </optgroup>
                      <optgroup label="Petah Tikva">
                        {['Am Israel Hai','City Center','Ein Ganim','Hadar Ganim','Kfar Avraham','Kfar Ganim','Kiryat Aryeh','Kiryat Matalon','Neve Oz','Ramat Siv','Yad Labanim'].map(n => <option key={n} value={`Petah Tikva - ${n}`}>{n}</option>)}
                      </optgroup>
                      <optgroup label="Rishon LeZion">
                        {['City Center','HaHadasha','HaMizrah','Kiryat Rishon','Maarav','Nahalat Yehuda','Neve Dekalim','Neve Hof','Neve Ilan','Old Rishon','Ramat Eliyahu','Ramat Ilan','Superland Area'].map(n => <option key={n} value={`Rishon LeZion - ${n}`}>{n}</option>)}
                      </optgroup>
                      <optgroup label="Ramat Gan">
                        {['City Center','Diamond Exchange','Givat Geula','Kiryat Borochov','Kiryat Krinitzi','Neve Yehoshua','Ramat Chen','Ramat Efal','Ramat Shikma','Tel Binyamin'].map(n => <option key={n} value={`Ramat Gan - ${n}`}>{n}</option>)}
                      </optgroup>
                      <optgroup label="Herzliya">
                        {['City Center','Herzliya HaTzeira','Herzliya Pituah','Neve Amal','Neve Oved','Nof Yam','Ramat HaSharon'].map(n => <option key={n} value={`Herzliya - ${n}`}>{n}</option>)}
                      </optgroup>
                      <optgroup label="Raanana">
                        {['City Center','Neve Zemer','North Raanana','Ramat Raanana','South Raanana','West Raanana'].map(n => <option key={n} value={`Raanana - ${n}`}>{n}</option>)}
                      </optgroup>
                      <optgroup label="Kfar Saba">
                        {['City Center','Green Kfar Saba','Neve Issar','North Kfar Saba','Old Kfar Saba','South Kfar Saba','Yoseftal'].map(n => <option key={n} value={`Kfar Saba - ${n}`}>{n}</option>)}
                      </optgroup>
                      <optgroup label="Modiin">
                        {['Avnei Hen','Buchman','City Center','Hahashmonaim','Moriah','Neve Ilan','Reut'].map(n => <option key={n} value={`Modiin - ${n}`}>{n}</option>)}
                      </optgroup>
                      <optgroup label="Beit Shemesh">
                        {['City Center','Givat Sharett','Nofei HaShemesh','Old Beit Shemesh','Ramat Beit Shemesh Alef','Ramat Beit Shemesh Bet','Ramat Beit Shemesh Gimmel','Sheinfeld'].map(n => <option key={n} value={`Beit Shemesh - ${n}`}>{n}</option>)}
                      </optgroup>
                      <optgroup label="Eilat">
                        {['Arava','City Center','HaDekel','HaSharon','North Beach','North Eilat','Shahamon','South Eilat','Tourist Center'].map(n => <option key={n} value={`Eilat - ${n}`}>{n}</option>)}
                      </optgroup>
                      <optgroup label="Other Cities">
                        {['Acre (Akko)','Arad','Ariel','Bat Yam','Bnei Brak','Caesarea','Dimona','Gedera','Givat Shmuel','Givatayim','Hadera','Harish','Hod HaSharon','Holon','Kiryat Ata','Kiryat Gat','Kiryat Ono','Kiryat Yam','Lod','Maale Adumim','Nahariya','Nazareth','Nes Ziona','Nesher','Netivot','Or Yehuda','Rahat','Ramla','Rehovot','Rosh HaAyin','Safed (Tzfat)','Sderot','Shoham','Tiberias','Yavne','Yokneam','Zichron Yaakov'].map(n => <option key={n} value={n}>{n}</option>)}
                      </optgroup>
                    </select>
                  </div>
                  <div>
                    <label className="block text-sm font-medium mb-2">{t('property.address')}</label>
                    <input
                      type="text"
                      value={propertyForm.address}
                      onChange={(e) => setPropertyForm({ ...propertyForm, address: e.target.value })}
                      className="w-full px-4 py-2 rounded-lg border border-[#E5E5E5] focus:outline-none focus:ring-2 focus:ring-[#1E6A6A]/50"
                      data-testid="property-address-input"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium mb-2">{t('property.sqm')}</label>
                    <input
                      type="number"
                      value={propertyForm.square_meters}
                      onChange={(e) => setPropertyForm({ ...propertyForm, square_meters: parseFloat(e.target.value) || '' })}
                      min="0"
                      step="0.1"
                      placeholder="Total apartment size"
                      className="w-full px-4 py-2 rounded-lg border border-[#E5E5E5] focus:outline-none focus:ring-2 focus:ring-[#1E6A6A]/50"
                      data-testid="property-sqm-input"
                    />
                  </div>
                  {propertyForm.rental_type !== 'storage' && (
                  <div>
                    <label className="block text-sm font-medium mb-2">{t('property.bedrooms')}</label>
                    <select
                      value={propertyForm.bedrooms}
                      onChange={(e) => setPropertyForm({ ...propertyForm, bedrooms: parseFloat(e.target.value) })}
                      className="w-full px-4 py-2 rounded-lg border border-[#E5E5E5] focus:outline-none focus:ring-2 focus:ring-[#1E6A6A]/50"
                      data-testid="property-bedrooms-input"
                    >
                      <option value="0">Studio</option>
                      <option value="1">1</option>
                      <option value="1.5">1.5</option>
                      <option value="2">2</option>
                      <option value="2.5">2.5</option>
                      <option value="3">3</option>
                      <option value="3.5">3.5</option>
                      <option value="4">4</option>
                      <option value="4.5">4.5</option>
                      <option value="5">5</option>
                      <option value="5.5">5.5</option>
                      <option value="6">6</option>
                      <option value="6.5">6.5</option>
                      <option value="7">7</option>
                      <option value="8">8+</option>
                    </select>
                  </div>
                  )}
                  {propertyForm.rental_type !== 'storage' && (
                  <div>
                    <label className="block text-sm font-medium mb-2">{t('property.bathrooms')}</label>
                    <select
                      value={propertyForm.bathrooms}
                      onChange={(e) => setPropertyForm({ ...propertyForm, bathrooms: parseFloat(e.target.value) })}
                      className="w-full px-4 py-2 rounded-lg border border-[#E5E5E5] focus:outline-none focus:ring-2 focus:ring-[#1E6A6A]/50"
                      data-testid="property-bathrooms-input"
                    >
                      <option value="1">1</option>
                      <option value="1.5">1.5</option>
                      <option value="2">2</option>
                      <option value="2.5">2.5</option>
                      <option value="3">3</option>
                      <option value="3.5">3.5</option>
                      <option value="4">4</option>
                      <option value="4.5">4.5</option>
                      <option value="5">5</option>
                      <option value="5.5">5.5</option>
                      <option value="6">6+</option>
                    </select>
                  </div>
                  )}
                  <div>
                    <label className="block text-sm font-medium mb-2">{t('property.floor')}</label>
                    <select
                      value={propertyForm.floor}
                      onChange={(e) => setPropertyForm({ ...propertyForm, floor: parseFloat(e.target.value) })}
                      className="w-full px-4 py-2 rounded-lg border border-[#E5E5E5] focus:outline-none focus:ring-2 focus:ring-[#1E6A6A]/50"
                      data-testid="property-floor-input"
                    >
                      <option value="-2">Basement 2</option>
                      <option value="-1">Basement 1</option>
                      <option value="0">{t('property.groundFloor')}</option>
                      <option value="1">1</option>
                      <option value="1.5">1.5</option>
                      <option value="2">2</option>
                      <option value="2.5">2.5</option>
                      <option value="3">3</option>
                      <option value="3.5">3.5</option>
                      <option value="4">4</option>
                      <option value="4.5">4.5</option>
                      <option value="5">5</option>
                      <option value="5.5">5.5</option>
                      <option value="6">6</option>
                      <option value="6.5">6.5</option>
                      <option value="7">7</option>
                      <option value="7.5">7.5</option>
                      <option value="8">8</option>
                      <option value="8.5">8.5</option>
                      <option value="9">9</option>
                      <option value="9.5">9.5</option>
                      <option value="10">10</option>
                      <option value="11">11</option>
                      <option value="12">12</option>
                      <option value="13">13</option>
                      <option value="14">14</option>
                      <option value="15">15</option>
                      <option value="20">20+</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-sm font-medium mb-2">Price {propertyForm.rental_type === 'vacation' ? '(per night)' : '(monthly)'}</label>
                    <div className="flex gap-2">
                      <input
                        type="number"
                        value={propertyForm.rental_type === 'vacation' ? propertyForm.nightly_price : propertyForm.monthly_price}
                        onChange={(e) => {
                          if (propertyForm.rental_type === 'vacation') {
                            setPropertyForm({ ...propertyForm, nightly_price: parseFloat(e.target.value) });
                          } else {
                            setPropertyForm({ ...propertyForm, monthly_price: parseFloat(e.target.value) });
                          }
                        }}
                        min="0"
                        className="flex-1 px-4 py-2 rounded-lg border border-[#E5E5E5] focus:outline-none focus:ring-2 focus:ring-[#1E6A6A]/50"
                        required
                        data-testid="property-price-input"
                      />
                      <select
                        value={propertyForm.currency}
                        onChange={(e) => setPropertyForm({ ...propertyForm, currency: e.target.value })}
                        className="px-4 py-2 rounded-lg border border-[#E5E5E5] focus:outline-none focus:ring-2 focus:ring-[#1E6A6A]/50"
                        data-testid="property-currency-select"
                      >
                        <option value="ILS">₪ ILS</option>
                        <option value="USD">$ USD</option>
                      </select>
                    </div>
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  {propertyForm.rental_type !== 'storage' && (
                  <div>
                    <label className="block text-sm font-medium mb-2">{t('property.condition')}</label>
                    <select
                      value={propertyForm.condition}
                      onChange={(e) => setPropertyForm({ ...propertyForm, condition: e.target.value })}
                      className="w-full px-4 py-2 rounded-lg border border-[#E5E5E5] focus:outline-none focus:ring-2 focus:ring-[#1E6A6A]/50"
                      data-testid="property-condition-select"
                    >
                      <option value="renovated">{t('property.renovated')}</option>
                      <option value="partially_renovated">{t('property.partiallyRenovated')}</option>
                      <option value="good">{t('property.goodCondition')}</option>
                    </select>
                  </div>
                  )}
                  {propertyForm.rental_type !== 'storage' && (
                  <div>
                    <label className="block text-sm font-medium mb-2">{t('property.numberOfPorches')}</label>
                    <input
                      type="number"
                      value={propertyForm.porches}
                      onChange={(e) => setPropertyForm({ ...propertyForm, porches: parseInt(e.target.value) || 0, sukkah_compatible: (parseInt(e.target.value) || 0) > 0 ? propertyForm.sukkah_compatible : false })}
                      min="0"
                      className="w-full px-4 py-2 rounded-lg border border-[#E5E5E5] focus:outline-none focus:ring-2 focus:ring-[#1E6A6A]/50"
                      data-testid="property-porches-input"
                    />
                    {propertyForm.porches > 0 && (
                      <>
                        <div className="ml-2 mt-2">
                          <label className="block text-sm text-gray-600 mb-1">{t('property.parchSqm')}</label>
                          <input
                            type="number"
                            value={propertyForm.porch_square_meters}
                            onChange={(e) => setPropertyForm({ ...propertyForm, porch_square_meters: parseFloat(e.target.value) || '' })}
                            min="0"
                            step="0.1"
                            className="w-full px-3 py-2 rounded-lg border border-[#E5E5E5] focus:outline-none focus:ring-2 focus:ring-[#1E6A6A]/50 text-sm"
                            data-testid="property-porch-sqm-input"
                          />
                        </div>
                        <label className="flex items-center gap-2 ml-2 mt-2">
                          <input
                            type="checkbox"
                            checked={propertyForm.sukkah_compatible}
                            onChange={(e) => setPropertyForm({ ...propertyForm, sukkah_compatible: e.target.checked })}
                            className="w-4 h-4 rounded border-[#E5E5E5]"
                            data-testid="property-sukkah-checkbox"
                          />
                          <span className="text-sm text-gray-600">{t('property.sukkah')}</span>
                        </label>
                      </>
                    )}
                  </div>
                  )}
                  {propertyForm.rental_type === 'long-term' && (
                    <div>
                      <label className="block text-sm font-medium mb-2">{t('property.furnitureOption')}</label>
                      <select
                        value={propertyForm.furniture_option}
                        onChange={(e) => setPropertyForm({ ...propertyForm, furniture_option: e.target.value })}
                        className="w-full px-4 py-2 rounded-lg border border-[#E5E5E5] focus:outline-none focus:ring-2 focus:ring-[#1E6A6A]/50"
                        data-testid="property-furniture-select"
                      >
                        <option value="no_furniture">{t('property.noFurniture')}</option>
                        <option value="furniture_package">{t('property.furniturePackage')}</option>
                        <option value="furniture_free">{t('property.furnitureFree')}</option>
                      </select>
                    </div>
                  )}
                </div>

                <div className="grid grid-cols-2 md:grid-cols-3 gap-6">
                  <div className="flex flex-col gap-2">
                    <label className="flex items-center gap-2">
                      <input
                        type="checkbox"
                        checked={propertyForm.has_elevator}
                        onChange={(e) => setPropertyForm({ ...propertyForm, has_elevator: e.target.checked, is_shabbat_elevator: e.target.checked ? propertyForm.is_shabbat_elevator : false })}
                        className="w-5 h-5 rounded border-[#E5E5E5]"
                        data-testid="property-elevator-checkbox"
                      />
                      <span>{t('property.elevator')}</span>
                    </label>
                    {propertyForm.has_elevator && (
                      <label className="flex items-center gap-2 ml-7">
                        <input
                          type="checkbox"
                          checked={propertyForm.is_shabbat_elevator}
                          onChange={(e) => setPropertyForm({ ...propertyForm, is_shabbat_elevator: e.target.checked })}
                          className="w-4 h-4 rounded border-[#E5E5E5]"
                          data-testid="property-shabbat-elevator-checkbox"
                        />
                        <span className="text-sm text-gray-600">{t('property.shabbatElevator')}</span>
                      </label>
                    )}
                  </div>
                  <div>
                    <label className="flex items-center gap-2">
                      <input
                        type="checkbox"
                        checked={propertyForm.is_tama}
                        onChange={(e) => setPropertyForm({ ...propertyForm, is_tama: e.target.checked })}
                        className="w-5 h-5 rounded border-[#E5E5E5]"
                        data-testid="property-tama-checkbox"
                      />
                      <span>Tama (Under Construction)</span>
                    </label>
                  </div>
                  <div className="flex flex-col gap-2">
                    <label className="flex items-center gap-2">
                      <input
                        type="checkbox"
                        checked={propertyForm.has_agent_fee}
                        onChange={(e) => setPropertyForm({ ...propertyForm, has_agent_fee: e.target.checked, agent_fee_price: e.target.checked ? propertyForm.agent_fee_price : '' })}
                        className="w-5 h-5 rounded border-[#E5E5E5]"
                        data-testid="property-agent-fee-checkbox"
                      />
                      <span>{t('property.agentFee')}</span>
                    </label>
                    {propertyForm.has_agent_fee && (
                      <div className="ml-7">
                        <div className="flex gap-2">
                          <input
                            type="number"
                            value={propertyForm.agent_fee_price}
                            onChange={(e) => setPropertyForm({ ...propertyForm, agent_fee_price: parseFloat(e.target.value) })}
                            placeholder="Fee amount"
                            min="0"
                            className="flex-1 px-3 py-2 rounded-lg border border-[#E5E5E5] focus:outline-none focus:ring-2 focus:ring-[#1E6A6A]/50 text-sm"
                            data-testid="property-agent-fee-input"
                          />
                          <select
                            value={propertyForm.agent_fee_currency}
                            onChange={(e) => setPropertyForm({ ...propertyForm, agent_fee_currency: e.target.value })}
                            className="px-3 py-2 rounded-lg border border-[#E5E5E5] focus:outline-none focus:ring-2 focus:ring-[#1E6A6A]/50 text-sm"
                            data-testid="property-agent-fee-currency-select"
                          >
                            <option value="ILS">₪</option>
                            <option value="USD">$</option>
                          </select>
                        </div>
                      </div>
                    )}
                  </div>
                </div>

                {propertyForm.rental_type !== 'storage' && (
                <div>
                  <label className="block text-sm font-medium mb-4">{t('property.amenities')}</label>
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                    {[
                      'Central AC / Heating',
                      'In-unit washer and dryer',
                      'Dishwasher',
                      'Walk in Closets',
                      'High Ceilings',
                      'Ensuite Bathroom',
                      'Storage Space',
                      'Heated Floors',
                      'Gym / Fitness center',
                      'Swimming pool (indoor or outdoor)',
                      'Hot tub / Spa',
                      'On-site parking (garage or lot)',
                      'Wi-Fi included'
                    ].map((amenity) => (
                      <label key={amenity} className="flex items-center gap-2">
                        <input
                          type="checkbox"
                          checked={propertyForm.amenities.includes(amenity)}
                          onChange={(e) => {
                            if (e.target.checked) {
                              setPropertyForm({
                                ...propertyForm,
                                amenities: [...propertyForm.amenities, amenity]
                              });
                            } else {
                              setPropertyForm({
                                ...propertyForm,
                                amenities: propertyForm.amenities.filter(a => a !== amenity)
                              });
                            }
                          }}
                          className="w-4 h-4 rounded border-[#E5E5E5]"
                        />
                        <span className="text-sm">{amenity}</span>
                      </label>
                    ))}
                  </div>
                </div>
                )}

                {/* File Upload Section */}
                <div data-testid="file-upload-section">
                  <label className="block text-sm font-medium mb-2">{t('property.photosVideos')}</label>
                  <div
                    className="border-2 border-dashed border-[#E5E5E5] rounded-xl p-6 text-center hover:border-black/30 transition-colors cursor-pointer"
                    onClick={() => document.getElementById('file-upload-input').click()}
                    onDragOver={(e) => { e.preventDefault(); e.currentTarget.classList.add('border-black/40', 'bg-gray-50'); }}
                    onDragLeave={(e) => { e.preventDefault(); e.currentTarget.classList.remove('border-black/40', 'bg-gray-50'); }}
                    onDrop={(e) => {
                      e.preventDefault();
                      e.currentTarget.classList.remove('border-black/40', 'bg-gray-50');
                      const dt = new DataTransfer();
                      Array.from(e.dataTransfer.files).forEach(f => dt.items.add(f));
                      const input = document.getElementById('file-upload-input');
                      input.files = dt.files;
                      input.dispatchEvent(new Event('change', { bubbles: true }));
                    }}
                    data-testid="file-drop-zone"
                  >
                    <Upload size={32} className="mx-auto mb-2 text-gray-400" />
                    <p className="text-sm text-gray-600 mb-1">{t('property.dragDrop')}</p>
                    <p className="text-xs text-gray-400">{t('property.fileTypes')}</p>
                    <input
                      id="file-upload-input"
                      type="file"
                      multiple
                      accept="image/jpeg,image/png,image/webp,image/gif,video/mp4,video/quicktime,video/webm"
                      className="hidden"
                      onChange={handleFileUpload}
                      data-testid="file-upload-input"
                    />
                  </div>

                  {uploading && (
                    <div className="mt-3" data-testid="upload-progress">
                      <div className="flex items-center gap-2 text-sm text-gray-600 mb-1">
                        <div className="w-4 h-4 border-2 border-black border-t-transparent rounded-full animate-spin"></div>
                        {t('property.uploading')} {uploadProgress}%
                      </div>
                      <div className="w-full bg-gray-200 rounded-full h-1.5">
                        <div className="h-1.5 rounded-full bg-black transition-all" style={{ width: `${uploadProgress}%` }}></div>
                      </div>
                    </div>
                  )}

                  {uploadedFiles.length > 0 && (
                    <div className="mt-4 grid grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-3" data-testid="uploaded-files-grid">
                      {uploadedFiles.map((file) => (
                        <div key={file.filename} className="relative group rounded-lg overflow-hidden border border-[#E5E5E5]" data-testid={`uploaded-file-${file.filename}`}>
                          {file.file_type === 'image' ? (
                            <img src={`${API.replace('/api', '')}${file.url}`} alt={file.original_name} className="w-full h-20 object-cover" />
                          ) : (
                            <div className="w-full h-20 bg-gray-900 flex items-center justify-center">
                              <Film size={24} className="text-white" />
                            </div>
                          )}
                          <button
                            type="button"
                            onClick={() => removeUploadedFile(file)}
                            className="absolute top-1 right-1 bg-black/70 text-white rounded-full p-0.5 opacity-0 group-hover:opacity-100 transition-opacity"
                            data-testid={`remove-file-${file.filename}`}
                          >
                            <X size={14} />
                          </button>
                          <div className="absolute bottom-0 left-0 right-0 bg-black/50 px-1 py-0.5">
                            <div className="flex items-center gap-1">
                              {file.file_type === 'image' ? <Image size={10} className="text-white" /> : <Film size={10} className="text-white" />}
                              <span className="text-[10px] text-white truncate">{file.original_name}</span>
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                <div className="flex gap-4">
                  <button type="submit" className="flex-1 primary-btn" data-testid="submit-property-button">
                    {editingPropertyId ? t('dashboard.saveChanges') : t('dashboard.addProperty')}
                  </button>
                  <button type="button" onClick={() => { setShowAddProperty(false); setEditingPropertyId(null); }} className="flex-1 secondary-btn" data-testid="cancel-add-property-button">
                    {t('dashboard.cancel')}
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}

        {user && user.role !== 'renter' && (
          <div className="mb-12">
            <h2 className="text-2xl font-bold mb-6" style={{ fontFamily: 'Playfair Display' }}>{t('dashboard.myProperties')}</h2>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {properties.map((property) => (
                <div key={property.id} className="bg-white rounded-2xl border border-[#E5E5E5] overflow-hidden" data-testid={`dashboard-property-${property.id}`}>
                  <div className="h-48 bg-gray-200" style={{
                    backgroundImage: `url(${property.images?.[0] ? (property.images[0].startsWith('/api') ? `${API.replace('/api', '')}${property.images[0]}` : property.images[0]) : 'https://images.pexels.com/photos/1669799/pexels-photo-1669799.jpeg?auto=compress&cs=tinysrgb&dpr=2&h=650&w=940'})`,
                    backgroundSize: 'cover',
                    backgroundPosition: 'center'
                  }}></div>
                  <div className="p-4">
                    <h3 className="text-lg font-bold mb-2">{property.title}</h3>
                    <p className="text-gray-600 text-sm mb-4">{property.area}</p>
                    <div className="flex items-center justify-between">
                      <span className="text-xl font-bold" style={{ color: '#1E6A6A' }}>
                        {property.currency === 'USD' ? '$' : '₪'}{property.monthly_price || property.nightly_price}
                      </span>
                      <div className="flex gap-2">
                        <button onClick={() => startEditProperty(property)} className="p-2 hover:bg-gray-100 rounded-lg" data-testid={`edit-property-${property.id}`}>
                          <Edit size={18} />
                        </button>
                        <button onClick={() => navigate(`/property/${property.id}`)} className="p-2 hover:bg-gray-100 rounded-lg" data-testid={`view-property-${property.id}`}>
                          <Eye size={18} />
                        </button>
                        <button onClick={() => handleDeleteProperty(property.id)} className="p-2 hover:bg-red-50 rounded-lg text-red-600" data-testid={`delete-property-${property.id}`}>
                          <Trash2 size={18} />
                        </button>
                      </div>
                    </div>
                    {/* iCal Sync for Vacation Properties */}
                    {property.rental_type === 'vacation' && (
                      <div className="mt-3 pt-3 border-t border-gray-100">
                        <button
                          onClick={() => openIcalPanel(property.id)}
                          className="w-full flex items-center justify-center gap-2 px-3 py-2 rounded-lg text-sm font-medium transition-all"
                          style={{ backgroundColor: icalPanel === property.id ? '#1E6A6A' : '#f5f5f0', color: icalPanel === property.id ? '#D4AF37' : '#1E6A6A' }}
                          data-testid={`ical-toggle-${property.id}`}
                        >
                          <CalendarSync size={15} />
                          {t('property.ical.title')}
                          {property.ical_urls?.length > 0 && <span className="w-5 h-5 rounded-full text-[10px] flex items-center justify-center font-bold bg-[#D4AF37] text-white">{property.ical_urls.length}</span>}
                        </button>

                        {icalPanel === property.id && (
                          <div className="mt-3 space-y-3" data-testid={`ical-panel-${property.id}`}>
                            <p className="text-xs text-gray-500">{t('property.ical.subtitle')}</p>

                            {/* Add URL */}
                            <div className="flex gap-2">
                              <input
                                type="url"
                                value={icalUrl}
                                onChange={(e) => setIcalUrl(e.target.value)}
                                placeholder={t('property.ical.urlPlaceholder')}
                                className="flex-1 px-3 py-2 rounded-lg border border-gray-200 text-sm focus:outline-none focus:border-[#D4AF37]"
                                data-testid={`ical-url-input-${property.id}`}
                              />
                              <button
                                onClick={() => addIcalUrl(property.id)}
                                disabled={icalSyncing || !icalUrl.trim()}
                                className="px-3 py-2 rounded-lg text-sm font-medium text-white disabled:opacity-40"
                                style={{ backgroundColor: '#1E6A6A' }}
                                data-testid={`ical-add-btn-${property.id}`}
                              >
                                {icalSyncing ? t('property.ical.syncing') : t('property.ical.add')}
                              </button>
                            </div>

                            {/* Connected Calendars */}
                            {property.ical_urls?.length > 0 ? (
                              <div className="space-y-1.5">
                                {property.ical_urls.map((url, i) => (
                                  <div key={i} className="flex items-center gap-2 px-3 py-2 rounded-lg bg-gray-50 text-xs">
                                    <Link2 size={12} className="text-[#D4AF37] shrink-0" />
                                    <span className="flex-1 truncate text-gray-600">{url}</span>
                                    <button onClick={() => removeIcalUrl(property.id, url)} className="text-red-400 hover:text-red-600 shrink-0" data-testid={`ical-remove-${i}`}>
                                      <X size={14} />
                                    </button>
                                  </div>
                                ))}
                              </div>
                            ) : (
                              <p className="text-xs text-gray-400 text-center py-2">{t('property.ical.noUrls')}</p>
                            )}

                            {/* Sync Status */}
                            {icalData[property.id] && (
                              <div className="flex items-center justify-between text-xs text-gray-500">
                                <span>{icalData[property.id].external?.length || 0} {t('property.ical.blockedDates')}</span>
                                <button onClick={() => manualSync(property.id)} disabled={icalSyncing} className="flex items-center gap-1 text-[#D4AF37] hover:underline disabled:opacity-40" data-testid={`ical-sync-btn-${property.id}`}>
                                  <RefreshCw size={12} className={icalSyncing ? 'animate-spin' : ''} />
                                  {t('property.ical.autoSync')}
                                </button>
                              </div>
                            )}

                            {/* Export */}
                            <div className="pt-2 border-t border-gray-100">
                              <p className="text-xs font-medium text-gray-700 mb-1">{t('property.ical.exportTitle')}</p>
                              <p className="text-[11px] text-gray-400 mb-2">{t('property.ical.exportDesc')}</p>
                              <button
                                onClick={() => copyExportUrl(property.id)}
                                className="w-full flex items-center justify-center gap-2 px-3 py-2 rounded-lg border border-gray-200 text-sm hover:border-[#D4AF37] transition-colors"
                                data-testid={`ical-export-btn-${property.id}`}
                              >
                                {copiedExport ? <Check size={14} className="text-green-500" /> : <Copy size={14} className="text-gray-500" />}
                                <span className="text-gray-700">{copiedExport ? t('property.ical.copied') : t('property.ical.copyUrl')}</span>
                              </button>
                            </div>
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        <div>
          <h2 className="text-2xl font-bold mb-6" style={{ fontFamily: 'Playfair Display' }}>{t('dashboard.myBookings')}</h2>
          <div className="bg-white rounded-2xl border border-[#E5E5E5] overflow-hidden">
            <table className="w-full">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-6 py-4 text-left text-sm font-medium text-gray-700">{t('property.title')}</th>
                  <th className="px-6 py-4 text-left text-sm font-medium text-gray-700">{t('dashboard.dates')}</th>
                  <th className="px-6 py-4 text-left text-sm font-medium text-gray-700">{t('dashboard.guests')}</th>
                  <th className="px-6 py-4 text-left text-sm font-medium text-gray-700">{t('admin.status')}</th>
                </tr>
              </thead>
              <tbody>
                {bookings.map((booking) => (
                  <tr key={booking.id} className="border-t border-[#E5E5E5]" data-testid={`booking-row-${booking.id}`}>
                    <td className="px-6 py-4">{booking.property_id}</td>
                    <td className="px-6 py-4">{booking.start_date} - {booking.end_date}</td>
                    <td className="px-6 py-4">{booking.guest_count}</td>
                    <td className="px-6 py-4">
                      <span className="px-3 py-1 rounded-full text-sm" style={{ backgroundColor: '#E5E5E5', color: '#1E6A6A' }}>
                        {booking.status}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Dashboard;