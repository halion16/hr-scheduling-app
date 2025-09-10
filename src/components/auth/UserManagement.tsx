import React, { useState, useEffect } from 'react';
import { useAuth, UserProfile } from '../../hooks/useAuth';
import { useLocalStorage } from '../../hooks/useLocalStorage';
import { Button } from '../common/Button';
import { Input } from '../common/Input';
import { Select } from '../common/Select';
import { Modal } from '../common/Modal';
import { 
  Users, 
  Plus, 
  Edit, 
  Trash2, 
  Shield, 
  ShieldCheck,
  ShieldX,
  Store as StoreIcon,
  UserCheck,
  UserX,
  Crown,
  Settings,
  AlertTriangle,
  CheckCircle,
  Save
} from 'lucide-react';

interface UserManagementProps {
  stores: Array<{ id: string; name: string; isActive: boolean }>;
}

export const UserManagement: React.FC<UserManagementProps> = ({ stores }) => {
  const { profile: currentUserProfile, hasPermission } = useAuth();
  const [users, setUsers] = useLocalStorage<UserProfile[]>('hr-auth-users', []);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [editingUser, setEditingUser] = useState<UserProfile | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [roleFilter, setRoleFilter] = useState<'all' | 'admin' | 'manager' | 'user'>('all');

  const [formData, setFormData] = useState({
    email: '',
    firstName: '',
    lastName: '',
    role: 'user' as UserProfile['role'],
    assignedStoreIds: [] as string[],
    isActive: true,
    customPermissions: [] as Permission[]
  });

  const [formErrors, setFormErrors] = useState<Record<string, string>>({});

  // Check if current user can manage users
  const canManageUsers = hasPermission('manage_users');

  useEffect(() => {
    setLoading(false);
  }, []);

  const validateForm = () => {
    const errors: Record<string, string> = {};

    if (!formData.email.trim()) {
      errors.email = 'Email richiesta';
    } else if (!/\S+@\S+\.\S+/.test(formData.email)) {
      errors.email = 'Formato email non valido';
    }

    if (!formData.firstName.trim()) {
      errors.firstName = 'Nome richiesto';
    }

    if (!formData.lastName.trim()) {
      errors.lastName = 'Cognome richiesto';
    }

    if (formData.role === 'manager' && formData.assignedStoreIds.length === 0) {
      errors.assignedStoreIds = 'I manager devono avere almeno un negozio assegnato';
    }

    setFormErrors(errors);
    return Object.keys(errors).length === 0;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!validateForm()) return;

    try {
      if (editingUser) {
        // Update existing user
        const updatedUser: UserProfile = {
          ...editingUser,
          email: formData.email,
          first_name: formData.firstName,
          last_name: formData.lastName,
          role: formData.role,
          custom_permissions: formData.customPermissions,
          assigned_store_ids: formData.assignedStoreIds,
          is_active: formData.isActive,
          updated_at: new Date().toISOString()
        };

        setUsers(prev => prev.map(u => u.id === editingUser.id ? updatedUser : u));

        alert('✅ Utente aggiornato con successo!');
      } else {
        // Create new user
        const newUser: UserProfile = {
          id: crypto.randomUUID(),
          email: formData.email,
          first_name: formData.firstName,
          last_name: formData.lastName,
          role: formData.role,
          custom_permissions: formData.customPermissions,
          assigned_store_ids: formData.assignedStoreIds,
          is_active: formData.isActive,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString()
        };

        setUsers(prev => [...prev, newUser]);

        // Store default password
        const currentPasswords = JSON.parse(localStorage.getItem('hr-auth-passwords') || '{}');
        currentPasswords[formData.email] = 'password123'; // Default password
        localStorage.setItem('hr-auth-passwords', JSON.stringify(currentPasswords));

        alert('✅ Utente creato con successo! Password temporanea: password123');
      }

      setShowModal(false);
      setEditingUser(null);
    } catch (error) {
      console.error('Error saving user:', error);
      alert('Errore durante il salvataggio');
    }
  };

  const handleEdit = (user: UserProfile) => {
    setEditingUser(user);
    setFormData({
      email: user.email,
      firstName: user.first_name,
      lastName: user.last_name,
      role: user.role,
      assignedStoreIds: user.assigned_store_ids || [],
      isActive: user.is_active,
      customPermissions: user.custom_permissions || ROLE_PERMISSIONS[user.role] || []
    });
    setShowModal(true);
  };

  const handleDelete = async (userId: string) => {
    const user = users.find(u => u.id === userId);
    if (!user) return;

    if (!confirm(`⚠️ Eliminare l'utente ${user.first_name} ${user.last_name}?\n\nQuesta azione eliminerà anche l'account di autenticazione e non può essere annullata.`)) {
      return;
    }

    try {
      // Remove user from array
      setUsers(prev => prev.filter(u => u.id !== userId));
      
      // Remove password
      const currentPasswords = JSON.parse(localStorage.getItem('hr-auth-passwords') || '{}');
      delete currentPasswords[user.email];
      localStorage.setItem('hr-auth-passwords', JSON.stringify(currentPasswords));

      alert('✅ Utente eliminato con successo!');
    } catch (error) {
      console.error('Error deleting user:', error);
      alert('Errore durante l\'eliminazione');
    }
  };

  const toggleUserStatus = async (userId: string, newStatus: boolean) => {
    try {
      setUsers(prev => prev.map(u => 
        u.id === userId ? { 
          ...u, 
          is_active: newStatus,
          updated_at: new Date().toISOString()
        } : u
      ));

      alert(`✅ Utente ${newStatus ? 'attivato' : 'disattivato'} con successo!`);
    } catch (error) {
      console.error('Error toggling user status:', error);
      alert('Errore durante l\'aggiornamento dello stato');
    }
  };

  const filteredUsers = users.filter(user => {
    const matchesSearch = 
      user.first_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      user.last_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      user.email.toLowerCase().includes(searchTerm.toLowerCase());
    
    const matchesRole = roleFilter === 'all' || user.role === roleFilter;

    return matchesSearch && matchesRole;
  });

  const getRoleIcon = (role: UserProfile['role']) => {
    switch (role) {
      case 'admin': return <Crown className="h-4 w-4 text-red-600" />;
      case 'manager': return <ShieldCheck className="h-4 w-4 text-blue-600" />;
      default: return <Shield className="h-4 w-4 text-gray-600" />;
    }
  };

  const getRoleColor = (role: UserProfile['role']) => {
    switch (role) {
      case 'admin': return 'bg-red-100 text-red-800';
      case 'manager': return 'bg-blue-100 text-blue-800';
      default: return 'bg-gray-100 text-gray-800';
    }
  };

  const getRoleLabel = (role: UserProfile['role']) => {
    switch (role) {
      case 'admin': return 'Amministratore';
      case 'manager': return 'Manager';
      default: return 'Utente';
    }
  };

  const roleOptions = [
    { value: 'all', label: 'Tutti i Ruoli' },
    { value: 'admin', label: 'Amministratori' },
    { value: 'manager', label: 'Manager' },
    { value: 'user', label: 'Utenti' }
  ];

  const userRoleOptions = [
    { value: 'user', label: 'Utente' },
    { value: 'manager', label: 'Manager' },
    { value: 'admin', label: 'Amministratore' }
  ];

  // Permissions organized by category
  const permissionsByCategory = {
    'Negozi e Strutture': [
      { permission: 'view_all_stores' as Permission, label: 'Visualizza Tutti i Negozi', description: 'Accesso a tutti i punti vendita del sistema' },
      { permission: 'manage_stores' as Permission, label: 'Gestisci Negozi', description: 'Creare, modificare ed eliminare negozi' }
    ],
    'Gestione Personale': [
      { permission: 'manage_employees' as Permission, label: 'Gestisci Dipendenti', description: 'Creare, modificare ed eliminare dipendenti' }
    ],
    'Pianificazione Turni': [
      { permission: 'manage_shifts' as Permission, label: 'Gestisci Turni', description: 'Creare, modificare ed eliminare turni' },
      { permission: 'generate_schedules' as Permission, label: 'Genera Pianificazioni', description: 'Usare algoritmi automatici di rotazione' }
    ],
    'Approvazioni e Richieste': [
      { permission: 'approve_requests' as Permission, label: 'Approva Richieste', description: 'Approvare indisponibilità e sostituzioni' }
    ],
    'Banca Ore': [
      { permission: 'manage_hour_bank' as Permission, label: 'Gestisci Banca Ore', description: 'Calcolare e gestire eccedenze orarie' }
    ],
    'Report e Analisi': [
      { permission: 'view_analytics' as Permission, label: 'Visualizza Report', description: 'Accedere a statistiche e analisi' },
      { permission: 'export_data' as Permission, label: 'Esporta Dati', description: 'Scaricare Excel e PDF' }
    ],
    'Amministrazione Sistema': [
      { permission: 'manage_users' as Permission, label: 'Gestisci Utenti', description: 'Creare e modificare account utente' },
      { permission: 'reset_data' as Permission, label: 'Reset Dati', description: 'Cancellare e ripristinare dati del sistema' }
    ]
  };

  const setRoleBasedPermissions = (role: UserProfile['role']) => {
    setFormData(prev => ({ 
      ...prev, 
      role,
      customPermissions: ROLE_PERMISSIONS[role] || []
    }));
  };

  const togglePermission = (permission: Permission) => {
    setFormData(prev => ({
      ...prev,
      customPermissions: prev.customPermissions.includes(permission)
        ? prev.customPermissions.filter(p => p !== permission)
        : [...prev.customPermissions, permission]
    }));
  };

  const selectAllPermissions = () => {
    const allPermissions = Object.values(permissionsByCategory).flat().map(p => p.permission);
    setFormData(prev => ({ ...prev, customPermissions: allPermissions }));
  };

  const clearAllPermissions = () => {
    setFormData(prev => ({ ...prev, customPermissions: [] }));
  };

  if (!canManageUsers) {
    return (
      <div className="text-center py-12">
        <ShieldX className="h-12 w-12 text-red-500 mx-auto mb-4" />
        <h3 className="text-lg font-medium text-gray-900 mb-2">Accesso Negato</h3>
        <p className="text-gray-500">Non hai i permessi per gestire gli utenti del sistema.</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center space-x-3">
          <Users className="h-6 w-6 text-blue-600" />
          <div>
            <h2 className="text-2xl font-bold text-gray-900">Gestione Utenti</h2>
            <p className="text-gray-600">Amministra utenti, ruoli e permessi del sistema</p>
          </div>
        </div>
        
        <div className="flex items-center space-x-3">
          <div className="text-sm bg-blue-100 text-blue-800 px-3 py-1 rounded-full">
            {filteredUsers.length} utenti
          </div>
          
          <Button
            icon={Plus}
            onClick={() => {
              setEditingUser(null);
              setFormData({
                email: '',
                firstName: '',
                lastName: '',
                role: 'user',
                assignedStoreIds: [],
                isActive: true,
                customPermissions: ROLE_PERMISSIONS['user'] || []
              });
              setShowModal(true);
            }}
          >
            Nuovo Utente
          </Button>
        </div>
      </div>

      {/* Role Info Panel */}
      <div className="bg-white rounded-lg border border-gray-200 p-4">
        <h3 className="text-md font-medium text-gray-900 mb-3">📋 Ruoli e Permessi</h3>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-sm">
          <div className="bg-red-50 border border-red-200 rounded p-3">
            <div className="flex items-center space-x-2 mb-2">
              <Crown className="h-4 w-4 text-red-600" />
              <span className="font-medium text-red-900">Amministratore</span>
            </div>
            <ul className="text-red-700 space-y-1 text-xs">
              <li>• Accesso completo a tutto</li>
              <li>• Gestione utenti e ruoli</li>
              <li>• Reset dati sistema</li>
              <li>• Tutti i negozi</li>
            </ul>
          </div>
          
          <div className="bg-blue-50 border border-blue-200 rounded p-3">
            <div className="flex items-center space-x-2 mb-2">
              <ShieldCheck className="h-4 w-4 text-blue-600" />
              <span className="font-medium text-blue-900">Manager</span>
            </div>
            <ul className="text-blue-700 space-y-1 text-xs">
              <li>• Gestione negozi assegnati</li>
              <li>• Approvazione richieste</li>
              <li>• Modifica turni e dipendenti</li>
              <li>• Banca ore</li>
            </ul>
          </div>
          
          <div className="bg-gray-50 border border-gray-200 rounded p-3">
            <div className="flex items-center space-x-2 mb-2">
              <Shield className="h-4 w-4 text-gray-600" />
              <span className="font-medium text-gray-900">Utente</span>
            </div>
            <ul className="text-gray-700 space-y-1 text-xs">
              <li>• Solo visualizzazione</li>
              <li>• Richieste indisponibilità</li>
              <li>• Export dati limitato</li>
              <li>• Accesso al proprio negozio</li>
            </ul>
          </div>
        </div>
      </div>

      {/* Filters */}
      <div className="bg-white rounded-lg border border-gray-200 p-4">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <Input
            placeholder="Cerca per nome, cognome o email..."
            value={searchTerm}
            onChange={setSearchTerm}
          />
          
          <Select
            value={roleFilter}
            onChange={setRoleFilter}
            options={roleOptions}
          />
        </div>
      </div>

      {/* Users List */}
      <div className="bg-white rounded-lg shadow-sm border border-gray-200 overflow-hidden">
        {loading ? (
          <div className="text-center py-12">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto mb-4"></div>
            <p className="text-gray-600">Caricamento utenti...</p>
          </div>
        ) : filteredUsers.length > 0 ? (
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Utente
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Ruolo
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Negozi Assegnati
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Stato
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Registrato
                  </th>
                  <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Azioni
                  </th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {filteredUsers.map((user) => {
                  const isCurrentUser = user.id === currentUserProfile?.id;
                  const userStores = stores.filter(store => 
                    user.assigned_store_ids?.includes(store.id)
                  );

                  return (
                    <tr key={user.id} className="hover:bg-gray-50">
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="flex items-center space-x-3">
                          <div className={`w-10 h-10 rounded-full flex items-center justify-center ${
                            user.is_active ? 'bg-green-100' : 'bg-gray-100'
                          }`}>
                            {user.is_active ? (
                              <UserCheck className="h-5 w-5 text-green-600" />
                            ) : (
                              <UserX className="h-5 w-5 text-gray-600" />
                            )}
                          </div>
                          <div>
                            <div className="font-medium text-gray-900">
                              {user.first_name} {user.last_name}
                              {isCurrentUser && (
                                <span className="ml-2 text-xs bg-blue-100 text-blue-800 px-2 py-1 rounded">
                                  Tu
                                </span>
                              )}
                            </div>
                            <div className="text-sm text-gray-500">{user.email}</div>
                          </div>
                        </div>
                      </td>

                      <td className="px-6 py-4 whitespace-nowrap">
                        <span className={`inline-flex items-center px-3 py-1 rounded-full text-sm font-medium ${getRoleColor(user.role)}`}>
                          {getRoleIcon(user.role)}
                          <span className="ml-2">{getRoleLabel(user.role)}</span>
                        </span>
                      </td>

                      <td className="px-6 py-4 whitespace-nowrap">
                        {user.role === 'admin' ? (
                          <span className="text-sm text-gray-500 italic">Tutti i negozi</span>
                        ) : userStores.length > 0 ? (
                          <div className="space-y-1">
                            {userStores.slice(0, 2).map(store => (
                              <div key={store.id} className="flex items-center space-x-1">
                                <StoreIcon className="h-3 w-3 text-gray-500" />
                                <span className="text-sm text-gray-700">{store.name}</span>
                              </div>
                            ))}
                            {userStores.length > 2 && (
                              <span className="text-xs text-gray-500">
                                +{userStores.length - 2} altri
                              </span>
                            )}
                          </div>
                        ) : (
                          <span className="text-sm text-gray-400">Nessun negozio</span>
                        )}
                      </td>

                      <td className="px-6 py-4 whitespace-nowrap">
                        <span className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${
                          user.is_active 
                            ? 'bg-green-100 text-green-800' 
                            : 'bg-red-100 text-red-800'
                        }`}>
                          {user.is_active ? 'Attivo' : 'Disattivato'}
                        </span>
                      </td>

                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                        {new Date(user.created_at).toLocaleDateString('it-IT')}
                      </td>

                      <td className="px-6 py-4 whitespace-nowrap text-right">
                        <div className="flex justify-end space-x-2">
                          {!isCurrentUser && (
                            <Button
                              size="sm"
                              variant={user.is_active ? "outline" : "success"}
                              icon={user.is_active ? UserX : UserCheck}
                              onClick={() => toggleUserStatus(user.id, !user.is_active)}
                              title={user.is_active ? 'Disattiva utente' : 'Riattiva utente'}
                            >
                              {user.is_active ? 'Disattiva' : 'Riattiva'}
                            </Button>
                          )}
                          
                          <Button
                            size="sm"
                            variant="outline"
                            icon={Edit}
                            onClick={() => handleEdit(user)}
                          >
                            Modifica
                          </Button>
                          
                          {!isCurrentUser && (
                            <Button
                              size="sm"
                              variant="danger"
                              icon={Trash2}
                              onClick={() => handleDelete(user.id)}
                            >
                              Elimina
                            </Button>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="text-center py-12">
            <Users className="h-12 w-12 text-gray-400 mx-auto mb-4" />
            <h3 className="text-lg font-medium text-gray-900 mb-2">
              {searchTerm || roleFilter !== 'all' ? 'Nessun utente trovato' : 'Nessun utente registrato'}
            </h3>
            <p className="text-gray-500">
              {searchTerm || roleFilter !== 'all' 
                ? 'Prova a modificare i filtri di ricerca.' 
                : 'Gli utenti registrati appariranno qui.'}
            </p>
          </div>
        )}
      </div>

      {/* Edit User Modal */}
      <Modal
        isOpen={showModal}
        onClose={() => {
          setShowModal(false);
          setEditingUser(null);
          setFormErrors({});
        }}
        title={editingUser ? `Modifica ${editingUser.first_name} ${editingUser.last_name}` : 'Nuovo Utente'}
        size="lg"
      >
        <form onSubmit={handleSubmit} className="space-y-6">
          <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
            <div className="flex items-center space-x-2 mb-2">
              <AlertTriangle className="h-5 w-5 text-yellow-600" />
              <span className="font-medium text-yellow-900">Importante</span>
            </div>
            <p className="text-sm text-yellow-800">
              {editingUser 
                ? 'Stai modificando un utente esistente. Le modifiche ai ruoli avranno effetto immediato.'
                : 'Creando un nuovo utente con password temporanea "password123". L\'utente dovrà cambiarla al primo accesso.'
              }
            </p>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <Input
              label="Nome"
              value={formData.firstName}
              onChange={(value) => setFormData(prev => ({ ...prev, firstName: value }))}
              error={formErrors.firstName}
              required
            />
            
            <Input
              label="Cognome"
              value={formData.lastName}
              onChange={(value) => setFormData(prev => ({ ...prev, lastName: value }))}
              error={formErrors.lastName}
              required
            />
          </div>

          <Input
            label="Email"
            type="email"
            value={formData.email}
            onChange={(value) => setFormData(prev => ({ ...prev, email: value }))}
            error={formErrors.email}
            required
            disabled={!!editingUser} // Email can't be changed when editing
          />

          <Select
            label="Ruolo"
            value={formData.role}
            onChange={(value) => setRoleBasedPermissions(value as UserProfile['role'])}
            options={userRoleOptions}
            required
          />

          {/* Custom Permissions Section */}
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <h4 className="text-md font-medium text-gray-900">Permessi Personalizzati</h4>
              <div className="flex space-x-2">
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  onClick={() => setFormData(prev => ({ ...prev, customPermissions: ROLE_PERMISSIONS[prev.role] }))}
                >
                  Usa Permessi Ruolo
                </Button>
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  onClick={selectAllPermissions}
                >
                  Seleziona Tutti
                </Button>
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  onClick={clearAllPermissions}
                >
                  Deseleziona Tutti
                </Button>
              </div>
            </div>

            <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
              <div className="flex items-center space-x-2 mb-2">
                <Shield className="h-4 w-4 text-blue-600" />
                <span className="text-sm font-medium text-blue-900">Configurazione Avanzata</span>
              </div>
              <p className="text-sm text-blue-800">
                Seleziona i permessi specifici per questo utente. I permessi personalizzati sovrascrivono quelli del ruolo base.
                Attualmente selezionati: <strong>{formData.customPermissions.length}</strong> permessi.
              </p>
            </div>

            <div className="space-y-4 max-h-60 overflow-y-auto border border-gray-200 rounded-lg p-4">
              {Object.entries(permissionsByCategory).map(([category, permissions]) => (
                <div key={category}>
                  <h5 className="text-sm font-semibold text-gray-900 mb-2 border-b border-gray-200 pb-1">
                    {category}
                  </h5>
                  <div className="grid grid-cols-1 gap-2">
                    {permissions.map(({ permission, label, description }) => (
                      <label key={permission} className="flex items-start space-x-3 p-2 hover:bg-gray-50 rounded cursor-pointer">
                        <input
                          type="checkbox"
                          checked={formData.customPermissions.includes(permission)}
                          onChange={() => togglePermission(permission)}
                          className="h-4 w-4 text-blue-600 rounded border-gray-300 focus:ring-blue-500 mt-0.5"
                        />
                        <div className="flex-1 min-w-0">
                          <div className="text-sm font-medium text-gray-900">{label}</div>
                          <div className="text-xs text-gray-600">{description}</div>
                        </div>
                      </label>
                    ))}
                  </div>
                </div>
              ))}
            </div>

            {formErrors.customPermissions && (
              <p className="text-sm text-red-600">{formErrors.customPermissions}</p>
            )}
          </div>

          {/* Store Assignment for Managers */}
          {(formData.role === 'manager' || formData.customPermissions.some(p => ['manage_stores', 'view_all_stores'].includes(p))) && (
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Negozi Assegnati {formData.role === 'manager' ? '*' : '(opzionale)'}
              </label>
              <div className="space-y-2 max-h-40 overflow-y-auto border border-gray-200 rounded-lg p-3">
                {stores.filter(store => store.isActive).map(store => (
                  <label key={store.id} className="flex items-center space-x-2">
                    <input
                      type="checkbox"
                      checked={formData.assignedStoreIds.includes(store.id)}
                      onChange={(e) => {
                        if (e.target.checked) {
                          setFormData(prev => ({
                            ...prev,
                            assignedStoreIds: [...prev.assignedStoreIds, store.id]
                          }));
                        } else {
                          setFormData(prev => ({
                            ...prev,
                            assignedStoreIds: prev.assignedStoreIds.filter(id => id !== store.id)
                          }));
                        }
                      }}
                      className="h-4 w-4 text-blue-600 rounded border-gray-300 focus:ring-blue-500"
                    />
                    <span className="text-sm text-gray-900">{store.name}</span>
                  </label>
                ))}
              </div>
              {formErrors.assignedStoreIds && (
                <p className="text-sm text-red-600 mt-1">{formErrors.assignedStoreIds}</p>
              )}
            </div>
          )}

          <div className="flex items-center space-x-2">
            <input
              type="checkbox"
              id="isActive"
              checked={formData.isActive}
              onChange={(e) => setFormData(prev => ({ ...prev, isActive: e.target.checked }))}
              className="h-4 w-4 text-blue-600 rounded border-gray-300 focus:ring-blue-500"
            />
            <label htmlFor="isActive" className="text-sm font-medium text-gray-700">
              Utente Attivo
            </label>
          </div>

          <div className="flex justify-end space-x-3 pt-4 border-t border-gray-200">
            <Button
              type="button"
              variant="outline"
              onClick={() => {
                setShowModal(false);
                setEditingUser(null);
                setFormErrors({});
              }}
            >
              Annulla
            </Button>
            
            <Button
              type="submit"
              icon={Save}
            >
              {editingUser ? 'Aggiorna' : 'Crea'} Utente
            </Button>
          </div>
        </form>
      </Modal>
    </div>
  );
};