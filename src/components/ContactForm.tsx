import React, { useState, useEffect } from 'react';
import { UserPlus, UserCheck, RefreshCcw, Trash2, HelpCircle, Compass, CheckCircle2, Loader2 } from 'lucide-react';
import { Contact } from '../types.js';

interface ContactFormProps {
  editTarget: Contact | null;
  onSave: (contact: { 
    full_name: string; 
    barangay: string; 
    purok: string; 
    contact_number: string;
    latitude?: number | null;
    longitude?: number | null;
    geotagged?: boolean;
  }) => Promise<boolean>;
  onCancel: () => void;
  showToast: (message: string, type: 'success' | 'warning' | 'error') => void;
}

export const ContactForm: React.FC<ContactFormProps> = ({ editTarget, onSave, onCancel, showToast }) => {
  const [fullName, setFullName] = useState('');
  const [barangay, setBarangay] = useState('');
  const [purok, setPurok] = useState('');
  const [contactNumber, setContactNumber] = useState('');
  const [latitude, setLatitude] = useState<string>('');
  const [longitude, setLongitude] = useState<string>('');
  const [geotagged, setGeotagged] = useState(false);
  const [isGpsCapturing, setIsGpsCapturing] = useState(false);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (editTarget) {
      setFullName(editTarget.full_name);
      setBarangay(editTarget.barangay || '');
      setPurok(editTarget.purok || '');
      setContactNumber(editTarget.contact_number);
      setLatitude(editTarget.latitude !== undefined && editTarget.latitude !== null ? String(editTarget.latitude) : '');
      setLongitude(editTarget.longitude !== undefined && editTarget.longitude !== null ? String(editTarget.longitude) : '');
      setGeotagged(!!editTarget.geotagged);
    } else {
      clearForm();
    }
  }, [editTarget]);

  const clearForm = () => {
    setFullName('');
    setBarangay('');
    setPurok('');
    setContactNumber('');
    setLatitude('');
    setLongitude('');
    setGeotagged(false);
  };

  const handleCaptureGps = () => {
    if (!navigator.geolocation) {
      showToast('Geolocation is not supported by your browser.', 'error');
      return;
    }

    setIsGpsCapturing(true);
    showToast('Acquiring device GPS sensor...', 'info');
    navigator.geolocation.getCurrentPosition(
      (position) => {
        setLatitude(position.coords.latitude.toFixed(6));
        setLongitude(position.coords.longitude.toFixed(6));
        setGeotagged(true);
        setIsGpsCapturing(false);
        showToast('Successfully locked and captured GPS coordinates!', 'success');
      },
      (error) => {
        console.error('Error getting location:', error);
        setIsGpsCapturing(false);
        showToast(`Failed to capture GPS: ${error.message}`, 'error');
      },
      { enableHighAccuracy: true, timeout: 12000, maximumAge: 0 }
    );
  };

  const handleCapitalization = (str: string): string => {
    return str
      .trim()
      .toLowerCase()
      .split(' ')
      .filter((word) => word.length > 0)
      .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
      .join(' ');
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    // Trim inputs
    const trimmedName = fullName.trim();
    const trimmedBarangay = barangay.trim();
    const trimmedPurok = purok.trim();
    const trimmedNumber = contactNumber.trim();

    // Validation checks
    if (!trimmedName) {
      showToast('Full Name is required.', 'warning');
      return;
    }
    if (!trimmedBarangay) {
      showToast('Barangay is required.', 'warning');
      return;
    }
    if (!trimmedNumber) {
      showToast('Contact Number is required.', 'warning');
      return;
    }

    // Capitalization format
    const formattedName = handleCapitalization(trimmedName);
    const formattedBarangay = handleCapitalization(trimmedBarangay);
    const formattedPurok = trimmedPurok ? handleCapitalization(trimmedPurok) : '';

    const parsedLat = latitude.trim() ? parseFloat(latitude.trim()) : null;
    const parsedLng = longitude.trim() ? parseFloat(longitude.trim()) : null;
    const isGeotagValid = geotagged || (parsedLat !== null && !isNaN(parsedLat) && parsedLng !== null && !isNaN(parsedLng));

    setSaving(true);
    try {
      const success = await onSave({
        full_name: formattedName,
        barangay: formattedBarangay,
        purok: formattedPurok,
        contact_number: trimmedNumber,
        latitude: parsedLat !== null && !isNaN(parsedLat) ? parsedLat : null,
        longitude: parsedLng !== null && !isNaN(parsedLng) ? parsedLng : null,
        geotagged: isGeotagValid
      });
      if (success && !editTarget) {
        clearForm();
      }
    } catch (err: any) {
      showToast(err.message || 'An error occurred while saving.', 'error');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="bg-white border border-slate-200 rounded-2xl p-6 shadow-sm">
      <div className="flex items-center gap-3 border-b border-slate-100 pb-4 mb-5">
        <div className={`p-2 rounded-xl text-white ${editTarget ? 'bg-indigo-600' : 'bg-emerald-600'}`}>
          {editTarget ? <UserCheck className="w-5 h-5" /> : <UserPlus className="w-5 h-5" />}
        </div>
        <div>
          <h4 className="font-bold text-slate-800 text-lg font-display">
            {editTarget ? 'Edit Directory Record' : 'Register Individual Contact'}
          </h4>
          <p className="text-xs text-slate-500">
            {editTarget ? `Modifying contact record ID #${editTarget.id}` : 'Fill in the details to create a new record'}
          </p>
        </div>
      </div>

      <form onSubmit={handleSubmit} className="space-y-5">
        {/* Full Name */}
        <div className="space-y-1.5">
          <div className="flex justify-between items-center">
            <label className="block text-xs font-semibold text-slate-600 uppercase tracking-wider">
              Full Name
            </label>
            <span className="text-red-500 text-xs font-bold">* Required</span>
          </div>
          <input
            type="text"
            value={fullName}
            onChange={(e) => setFullName(e.target.value)}
            className="w-full px-4 py-3 bg-slate-50 border border-slate-200 focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100 rounded-xl transition-all text-slate-800 text-sm font-medium outline-none placeholder:text-slate-400"
            placeholder="e.g. Juan Dela Cruz"
            disabled={saving}
          />
          <p className="text-[10px] text-slate-400">Will be capitalized properly automatically</p>
        </div>

        {/* Barangay & Purok */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {/* Barangay */}
          <div className="space-y-1.5">
            <div className="flex justify-between items-center">
              <label className="block text-xs font-semibold text-slate-600 uppercase tracking-wider">
                Barangay
              </label>
              <span className="text-red-500 text-xs font-bold">* Required</span>
            </div>
            <input
              type="text"
              value={barangay}
              onChange={(e) => setBarangay(e.target.value)}
              className="w-full px-4 py-3 bg-slate-50 border border-slate-200 focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100 rounded-xl transition-all text-slate-800 text-sm font-medium outline-none placeholder:text-slate-400"
              placeholder="e.g. Barangay San Jose"
              disabled={saving}
            />
          </div>

          {/* Purok */}
          <div className="space-y-1.5">
            <div className="flex justify-between items-center">
              <label className="block text-xs font-semibold text-slate-600 uppercase tracking-wider">
                Purok
              </label>
              <span className="text-slate-400 text-xs">(Optional)</span>
            </div>
            <input
              type="text"
              value={purok}
              onChange={(e) => setPurok(e.target.value)}
              className="w-full px-4 py-3 bg-slate-50 border border-slate-200 focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100 rounded-xl transition-all text-slate-800 text-sm font-medium outline-none placeholder:text-slate-400"
              placeholder="e.g. Purok 4"
              disabled={saving}
            />
          </div>
        </div>

        {/* Contact Number */}
        <div className="space-y-1.5">
          <div className="flex justify-between items-center">
            <label className="block text-xs font-semibold text-slate-600 uppercase tracking-wider">
              Contact Number
            </label>
            <span className="text-red-500 text-xs font-bold">* Required</span>
          </div>
          <input
            type="text"
            value={contactNumber}
            onChange={(e) => setContactNumber(e.target.value)}
            className="w-full px-4 py-3 bg-slate-50 border border-slate-200 focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100 rounded-xl transition-all text-slate-800 text-sm font-medium outline-none placeholder:text-slate-400"
            placeholder="e.g. 09171234567"
            disabled={saving}
          />
        </div>

        {/* Geotag GPS Section */}
        <div className="p-4 bg-slate-50 border border-slate-200/80 rounded-2xl space-y-3">
          <div className="flex items-center justify-between">
            <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider">
              Geotag GPS Coordinates
            </label>
            <button
              type="button"
              onClick={handleCaptureGps}
              disabled={isGpsCapturing}
              className="px-3 py-1.5 bg-teal-600 hover:bg-teal-700 disabled:bg-teal-400 text-white font-bold text-xs rounded-xl transition-all cursor-pointer flex items-center gap-1.5 shadow-xs"
            >
              {isGpsCapturing ? (
                <>
                  <Loader2 className="w-3.5 h-3.5 animate-spin" /> Capturing...
                </>
              ) : (
                <>
                  <Compass className="w-3.5 h-3.5" /> Capture Device GPS
                </>
              )}
            </button>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <input
                type="text"
                value={latitude}
                onChange={(e) => setLatitude(e.target.value)}
                placeholder="Latitude (e.g. 8.234123)"
                className="w-full px-3 py-2 bg-white border border-slate-200 focus:border-indigo-500 rounded-xl text-xs font-mono font-medium outline-none"
              />
            </div>
            <div>
              <input
                type="text"
                value={longitude}
                onChange={(e) => setLongitude(e.target.value)}
                placeholder="Longitude (e.g. 124.234123)"
                className="w-full px-3 py-2 bg-white border border-slate-200 focus:border-indigo-500 rounded-xl text-xs font-mono font-medium outline-none"
              />
            </div>
          </div>

          {geotagged && latitude && longitude && (
            <div className="flex items-center gap-1.5 text-xs font-bold text-teal-700">
              <CheckCircle2 className="w-4 h-4 text-teal-600" />
              <span>GPS Geotag locked ({latitude}, {longitude})</span>
            </div>
          )}
        </div>

        {/* Actions Buttons */}
        <div className="pt-4 flex flex-col sm:flex-row items-center gap-3 border-t border-slate-100">
          <button
            type="submit"
            disabled={saving}
            className={`w-full sm:w-auto px-6 py-3 text-white font-semibold text-sm rounded-xl transition-all flex items-center justify-center gap-2 cursor-pointer active:scale-[0.99] shadow-lg ${
              editTarget
                ? 'bg-indigo-600 hover:bg-indigo-700 shadow-indigo-50'
                : 'bg-emerald-600 hover:bg-emerald-700 shadow-emerald-50'
            }`}
          >
            {editTarget ? 'Update Contact Record' : 'Save New Contact'}
          </button>

          <button
            type="button"
            onClick={clearForm}
            disabled={saving}
            className="w-full sm:w-auto px-5 py-3 text-slate-600 hover:text-slate-800 bg-slate-100 hover:bg-slate-200 font-semibold text-sm rounded-xl transition-all flex items-center justify-center gap-2 cursor-pointer"
          >
            <RefreshCcw className="w-4 h-4" />
            Clear Form
          </button>

          <button
            type="button"
            onClick={onCancel}
            disabled={saving}
            className="w-full sm:w-auto sm:ml-auto px-5 py-3 text-slate-500 hover:text-slate-700 bg-transparent border border-slate-200 hover:border-slate-300 font-semibold text-sm rounded-xl transition-all flex items-center justify-center gap-1.5 cursor-pointer"
          >
            Cancel
          </button>
        </div>
      </form>
    </div>
  );
};
