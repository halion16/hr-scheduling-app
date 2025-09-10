import React, { useState } from 'react';
import { useAuth } from '../../hooks/useAuth';
import { Button } from '../common/Button';
import { Input } from '../common/Input';
import { Modal } from '../common/Modal';
import { 
  Settings, 
  LogIn, 
  UserPlus, 
  Eye, 
  EyeOff,
  Shield,
  AlertCircle,
  CheckCircle
} from 'lucide-react';

export const LoginPage: React.FC = () => {
  const { signIn, signUp, loading, error } = useAuth();
  const [isLoginMode, setIsLoginMode] = useState(true);
  const [showPassword, setShowPassword] = useState(false);
  const [showSignUpModal, setShowSignUpModal] = useState(false);
  
  const [loginData, setLoginData] = useState({
    email: '',
    password: ''
  });

  const [signUpData, setSignUpData] = useState({
    email: '',
    password: '',
    confirmPassword: '',
    firstName: '',
    lastName: ''
  });

  const [formErrors, setFormErrors] = useState<Record<string, string>>({});

  const validateLoginForm = () => {
    const errors: Record<string, string> = {};
    
    if (!loginData.email.trim()) {
      errors.email = 'Email richiesta';
    } else if (!/\S+@\S+\.\S+/.test(loginData.email)) {
      errors.email = 'Formato email non valido';
    }
    
    if (!loginData.password) {
      errors.password = 'Password richiesta';
    }
    
    setFormErrors(errors);
    return Object.keys(errors).length === 0;
  };

  const validateSignUpForm = () => {
    const errors: Record<string, string> = {};
    
    if (!signUpData.firstName.trim()) {
      errors.firstName = 'Nome richiesto';
    }
    
    if (!signUpData.lastName.trim()) {
      errors.lastName = 'Cognome richiesto';
    }
    
    if (!signUpData.email.trim()) {
      errors.email = 'Email richiesta';
    } else if (!/\S+@\S+\.\S+/.test(signUpData.email)) {
      errors.email = 'Formato email non valido';
    }
    
    if (!signUpData.password) {
      errors.password = 'Password richiesta';
    } else if (signUpData.password.length < 6) {
      errors.password = 'Password deve essere di almeno 6 caratteri';
    }
    
    if (signUpData.password !== signUpData.confirmPassword) {
      errors.confirmPassword = 'Le password non corrispondono';
    }
    
    setFormErrors(errors);
    return Object.keys(errors).length === 0;
  };

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!validateLoginForm()) return;

    const { error } = await signIn(loginData.email, loginData.password);
    if (error) {
      setFormErrors({ general: 'Email o password non corretti' });
    }
  };

  const handleSignUp = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!validateSignUpForm()) return;

    const { error } = await signUp(
      signUpData.email, 
      signUpData.password, 
      signUpData.firstName, 
      signUpData.lastName
    );
    
    if (error) {
      setFormErrors({ general: error.message });
    } else {
      setShowSignUpModal(false);
      alert('✅ Registrazione completata! Effettua il login per accedere.');
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-indigo-50 flex items-center justify-center">
      <div className="w-full max-w-md">
        {/* Logo e Header */}
        <div className="text-center mb-8">
          <div className="bg-blue-600 rounded-full w-16 h-16 flex items-center justify-center mx-auto mb-4">
            <Settings className="h-8 w-8 text-white" />
          </div>
          <h1 className="text-3xl font-bold text-gray-900 mb-2">Gestione HR</h1>
          <p className="text-gray-600">Sistema avanzato di pianificazione turni</p>
        </div>

        {/* Login Form */}
        <div className="bg-white rounded-xl shadow-lg border border-gray-200 p-8">
          <div className="flex items-center justify-center mb-6">
            <Shield className="h-6 w-6 text-blue-600 mr-2" />
            <h2 className="text-xl font-semibold text-gray-900">Accesso Sistema</h2>
          </div>

          {error && (
            <div className="mb-4 p-4 bg-red-50 border border-red-200 rounded-lg">
              <div className="flex items-center space-x-2">
                <AlertCircle className="h-5 w-5 text-red-600" />
                <span className="text-sm font-medium text-red-900">Errore di Accesso</span>
              </div>
              <p className="text-sm text-red-800 mt-1">{error}</p>
            </div>
          )}

          {formErrors.general && (
            <div className="mb-4 p-4 bg-red-50 border border-red-200 rounded-lg">
              <div className="flex items-center space-x-2">
                <AlertCircle className="h-5 w-5 text-red-600" />
                <span className="text-sm text-red-800">{formErrors.general}</span>
              </div>
            </div>
          )}

          <form onSubmit={handleLogin} className="space-y-6">
            <Input
              label="Email"
              type="email"
              value={loginData.email}
              onChange={(value) => setLoginData(prev => ({ ...prev, email: value }))}
              error={formErrors.email}
              placeholder="admin@example.com"
              required
              disabled={loading}
            />

            <div className="space-y-1">
              <label className="block text-sm font-medium text-gray-700">
                Password <span className="text-red-500">*</span>
              </label>
              <div className="relative">
                <input
                  type={showPassword ? 'text' : 'password'}
                  value={loginData.password}
                  onChange={(e) => setLoginData(prev => ({ ...prev, password: e.target.value }))}
                  className={`w-full px-3 py-2 pr-10 border rounded-lg shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 ${
                    formErrors.password ? 'border-red-300' : 'border-gray-300'
                  }`}
                  placeholder="••••••••"
                  required
                  disabled={loading}
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute inset-y-0 right-0 pr-3 flex items-center"
                  disabled={loading}
                >
                  {showPassword ? (
                    <EyeOff className="h-4 w-4 text-gray-400" />
                  ) : (
                    <Eye className="h-4 w-4 text-gray-400" />
                  )}
                </button>
              </div>
              {formErrors.password && (
                <p className="text-sm text-red-600">{formErrors.password}</p>
              )}
            </div>

            <Button
              type="submit"
              className="w-full bg-blue-600 hover:bg-blue-700 py-3"
              disabled={loading}
              icon={loading ? undefined : LogIn}
            >
              {loading ? 'Accesso in corso...' : 'Accedi'}
            </Button>
          </form>

          {/* Demo Credentials */}
          <div className="mt-6 p-4 bg-gray-50 rounded-lg border border-gray-200">
            <h3 className="text-sm font-medium text-gray-900 mb-2">🧪 Credenziali Demo</h3>
            <div className="space-y-2 text-sm">
              <div className="flex justify-between items-center">
                <span className="text-gray-600">Admin:</span>
                <code className="bg-white px-2 py-1 rounded text-xs">admin@example.com / admin123</code>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-gray-600">Manager:</span>
                <code className="bg-white px-2 py-1 rounded text-xs">manager@example.com / manager123</code>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-gray-600">User:</span>
                <code className="bg-white px-2 py-1 rounded text-xs">user@example.com / user123</code>
              </div>
            </div>
          </div>

          {/* Sign Up Link */}
          <div className="mt-6 text-center">
            <span className="text-sm text-gray-600">Non hai un account? </span>
            <button
              type="button"
              onClick={() => setShowSignUpModal(true)}
              className="text-sm font-medium text-blue-600 hover:text-blue-700"
              disabled={loading}
            >
              Registrati qui
            </button>
          </div>
        </div>

        {/* Footer */}
        <div className="text-center mt-8">
          <p className="text-sm text-gray-500">
            © 2025 Sistema Gestione HR v2.5 - Accesso Sicuro
          </p>
        </div>
      </div>

      {/* Sign Up Modal */}
      <Modal
        isOpen={showSignUpModal}
        onClose={() => setShowSignUpModal(false)}
        title="Registrazione Nuovo Utente"
        size="md"
      >
        <form onSubmit={handleSignUp} className="space-y-6">
          <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
            <div className="flex items-center space-x-2 mb-2">
              <UserPlus className="h-5 w-5 text-blue-600" />
              <span className="font-medium text-blue-900">Nuovo Account</span>
            </div>
            <p className="text-sm text-blue-800">
              I nuovi utenti vengono creati con ruolo "Utente" di default. 
              Contatta un amministratore per modifiche ai permessi.
            </p>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <Input
              label="Nome"
              value={signUpData.firstName}
              onChange={(value) => setSignUpData(prev => ({ ...prev, firstName: value }))}
              error={formErrors.firstName}
              required
              disabled={loading}
            />
            
            <Input
              label="Cognome"
              value={signUpData.lastName}
              onChange={(value) => setSignUpData(prev => ({ ...prev, lastName: value }))}
              error={formErrors.lastName}
              required
              disabled={loading}
            />
          </div>

          <Input
            label="Email"
            type="email"
            value={signUpData.email}
            onChange={(value) => setSignUpData(prev => ({ ...prev, email: value }))}
            error={formErrors.email}
            required
            disabled={loading}
          />

          <Input
            label="Password"
            type="password"
            value={signUpData.password}
            onChange={(value) => setSignUpData(prev => ({ ...prev, password: value }))}
            error={formErrors.password}
            placeholder="Minimo 6 caratteri"
            required
            disabled={loading}
          />

          <Input
            label="Conferma Password"
            type="password"
            value={signUpData.confirmPassword}
            onChange={(value) => setSignUpData(prev => ({ ...prev, confirmPassword: value }))}
            error={formErrors.confirmPassword}
            required
            disabled={loading}
          />

          <div className="flex justify-end space-x-3 pt-4 border-t border-gray-200">
            <Button
              type="button"
              variant="outline"
              onClick={() => setShowSignUpModal(false)}
              disabled={loading}
            >
              Annulla
            </Button>
            <Button
              type="submit"
              icon={UserPlus}
              disabled={loading}
            >
              {loading ? 'Creazione...' : 'Crea Account'}
            </Button>
          </div>
        </form>
      </Modal>
    </div>
  );
};