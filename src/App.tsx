import { AdministrativeOverview } from './components/AdministrativeOverview';
import React, { lazy, Suspense, useState, useEffect } from 'react';
import { 
  Tenant, 
  UserRole, 
  Candidate, 
  District, 
  Proposal, 
  DriveFileItem, 
  UserProfile, 
  CampaignExpense, 
  Leader, 
  TransportVehicle, 
  DonorContribution,
  CampaignCoordination,
  GrassrootsVoter
} from './types';
import {
  subscribeToCollection,
  saveCandidateToFirestore,
  saveExpenseToFirestore,
  deleteExpenseFromFirestore,
  seedNewTenantInitialData,
  saveLeaderToFirestore,
  saveVehicleToFirestore,
  saveProposalToFirestore,
  saveTenantToFirestore,
  deleteTenantFromFirestore,
  saveDonorContributionToFirestore,
  saveUserToFirestore,
  saveGrassrootsVoterToFirestore,
  saveCoordinationToFirestore,
  createDemoCollection,
  deleteDemoCollection,
  subscribeToDemoCollection
} from './lib/firebase';
import { buildDemoBundle, type DemoBundle } from './data/demoSeed';
import { logoutFirebaseAuth, observeAuthenticatedProfile } from './lib/firebaseAuth';
import { Header } from './components/Header';
import { Sidebar, ActiveTab } from './components/Sidebar';
import { FirestoreStatusModal } from './components/FirestoreStatusModal';
import { AuthModal } from './components/AuthModal';
import { LoginView } from './components/LoginView';
import { LandingPage } from './components/LandingPage';
import { UserGreetingBanner } from './components/UserGreetingBanner';
import { SynapticNeuralBackground } from './components/SynapticNeuralBackground';
import { ArrowLeft, LogIn, Sparkles, CheckCircle2, AlertCircle, RefreshCw, Database, LayoutDashboard, MapPinned } from 'lucide-react';

const DashboardView = lazy(() => import('./components/DashboardView').then(module => ({ default: module.DashboardView })));
const CampaignStructureView = lazy(() => import('./components/CampaignStructureView').then(module => ({ default: module.CampaignStructureView })));
const ElectoralHierarchyRollupView = lazy(() => import('./components/ElectoralHierarchyRollupView').then(module => ({ default: module.ElectoralHierarchyRollupView })));
const ElectoralSimulatorView = lazy(() => import('./components/ElectoralSimulatorView').then(module => ({ default: module.ElectoralSimulatorView })));
const CampaignCostsReportView = lazy(() => import('./components/CampaignCostsReportView').then(module => ({ default: module.CampaignCostsReportView })));
const ZoneElectoralProjectionView = lazy(() => import('./components/ZoneElectoralProjectionView').then(module => ({ default: module.ZoneElectoralProjectionView })));
const FinancesView = lazy(() => import('./components/FinancesView').then(module => ({ default: module.FinancesView })));
const LeadersView = lazy(() => import('./components/LeadersView').then(module => ({ default: module.LeadersView })));
const UniversalDataIngestionView = lazy(() => import('./components/UniversalDataIngestionView').then(module => ({ default: module.UniversalDataIngestionView })));
const TransportView = lazy(() => import('./components/TransportView').then(module => ({ default: module.TransportView })));
const CandidatesView = lazy(() => import('./components/CandidatesView').then(module => ({ default: module.CandidatesView })));
const DistrictsView = lazy(() => import('./components/DistrictsView').then(module => ({ default: module.DistrictsView })));
const ProposalsView = lazy(() => import('./components/ProposalsView').then(module => ({ default: module.ProposalsView })));
const DriveView = lazy(() => import('./components/DriveView').then(module => ({ default: module.DriveView })));
const GoogleWorkspaceHubView = lazy(() => import('./components/GoogleWorkspaceHubView').then(module => ({ default: module.GoogleWorkspaceHubView })));
const TerritorialMapView = lazy(() => import('./components/TerritorialMapView').then(module => ({ default: module.TerritorialMapView })));
const AiAssistantView = lazy(() => import('./components/AiAssistantView').then(module => ({ default: module.AiAssistantView })));
const TenantsView = lazy(() => import('./components/TenantsView').then(module => ({ default: module.TenantsView })));

const tenantFromInvite = new URLSearchParams(window.location.search).get('tenant');
const DEFAULT_TENANT_ID = tenantFromInvite || (import.meta as any).env?.VITE_DEFAULT_TENANT_ID || 'tenant-astrea-2026';
const EMPTY_TENANT: Tenant = {
  tenantId: DEFAULT_TENANT_ID,
  name: 'Astrea Suite Electoral',
  primaryColor: '#0f172a',
  secondaryColor: '#1e293b',
  createdAt: '',
  active: false
};
const PUBLIC_DEMO_TENANT: Tenant = { ...EMPTY_TENANT, tenantId: 'tenant-demo-publico', name: 'Astrea — Presentación Demo', active: true, createdAt: '2026-08-15T12:00:00.000Z', plan: 'Gratuito' };
const PUBLIC_DEMO_DATA = buildDemoBundle(PUBLIC_DEMO_TENANT.tenantId);
const PUBLIC_DEMO_USER: UserProfile = { uid: 'demo-publico', email: 'presentacion@demo.invalid', displayName: 'Visitante Demo', tenantId: PUBLIC_DEMO_TENANT.tenantId, role: 'Consulta', municipality: 'Astrea', department: 'Cesar', createdAt: '2026-08-15T12:00:00.000Z', active: true };

export default function App() {
  const [tenants, setTenants] = useState<Tenant[]>([]);
  const [currentTenant, setCurrentTenant] = useState<Tenant>(EMPTY_TENANT);
  const [users, setUsers] = useState<UserProfile[]>([]);
  
  const [currentUser, setCurrentUser] = useState<UserProfile | null>(null);
  const [userRole, setUserRole] = useState<UserRole>('Consulta');

  const [activeTab, setActiveTab] = useState<ActiveTab>('dashboard');

  // Auth modal state
  const [showAuthModal, setShowAuthModal] = useState<boolean>(false);
  const [showPublicDemo, setShowPublicDemo] = useState<boolean>(false);
  const [publicDemoView, setPublicDemoView] = useState<'dashboard' | 'map'>('dashboard');

  // Firestore modal state
  const [showFirestoreModal, setShowFirestoreModal] = useState<boolean>(false);
  const [firestoreSyncNotice, setFirestoreSyncNotice] = useState<string | null>(null);

  // Collections state
  const [candidates, setCandidates] = useState<Candidate[]>([]);
  const [districts, setDistricts] = useState<District[]>([]);
  const [proposals, setProposals] = useState<Proposal[]>([]);
  const [driveFiles, setDriveFiles] = useState<DriveFileItem[]>([]);

  // Campaign operational & finance state
  const [expenses, setExpenses] = useState<CampaignExpense[]>([]);
  const [donorContributions, setDonorContributions] = useState<DonorContribution[]>([]);
  const [leaders, setLeaders] = useState<Leader[]>([]);
  const [vehicles, setVehicles] = useState<TransportVehicle[]>([]);
  const [coordinations, setCoordinations] = useState<CampaignCoordination[]>([]);
  const [grassrootsVoters, setGrassrootsVoters] = useState<GrassrootsVoter[]>([]);
  const [demoBundle, setDemoBundle] = useState<DemoBundle | null>(null);
  const [demoBusy, setDemoBusy] = useState(false);
  const [demoError, setDemoError] = useState<string | null>(null);

  // Drive sync state
  const [driveSyncing, setDriveSyncing] = useState<boolean>(false);
  const [lastSyncStatus, setLastSyncStatus] = useState<string>('Base de datos Firestore sincronizada en tiempo real');

  // Flash notification helper
  const notifyFirestoreSave = (msg: string) => {
    setFirestoreSyncNotice(msg);
    setTimeout(() => setFirestoreSyncNotice(null), 4000);
  };

  useEffect(() => {
    return observeAuthenticatedProfile((profile) => {
      setCurrentUser(profile);
      setUserRole(profile?.role || 'Consulta');
      if (profile?.tenantId) {
        setCurrentTenant((tenant) => tenant.tenantId === profile.tenantId ? tenant : { ...EMPTY_TENANT, tenantId: profile.tenantId });
      }
    });
  }, []);

  // Real-time Firestore subscriptions for all active collections in Spanish
  useEffect(() => {
    const unsubTenants = subscribeToCollection<Tenant>('organizaciones', (data) => {
      if (data && data.length > 0) {
        setTenants(data);
        // Ensure current tenant remains valid
        setCurrentTenant((prev) => data.find((t) => t.tenantId === prev.tenantId) || data[0]);
      }
    }, [], currentUser?.tenantId);

    const unsubUsers = subscribeToCollection<UserProfile>('usuarios', (data) => {
      if (data && data.length > 0) {
        setUsers(data);
        // Keep the authenticated profile synchronized with Firestore.
        setCurrentUser((prev) => {
          if (!prev) return null;
          const updated = data.find((u) => u.uid === prev.uid || u.email.toLowerCase() === prev.email.toLowerCase());
          if (updated) {
            return updated;
          }
          return prev;
        });
      }
    }, [], currentUser?.tenantId);

    const unsubCandidates = subscribeToCollection<Candidate>('candidatos', (data) => {
      setCandidates(data);
    }, [], currentUser?.tenantId);

    const unsubDistricts = subscribeToCollection<District>('distritos', (data) => {
      setDistricts(data);
    }, [], currentUser?.tenantId);

    const unsubProposals = subscribeToCollection<Proposal>('propuestas', (data) => {
      setProposals(data);
    }, [], currentUser?.tenantId);

    const unsubExpenses = subscribeToCollection<CampaignExpense>('gastos', (data) => {
      setExpenses(data);
    }, [], currentUser?.tenantId);

    const unsubAportes = subscribeToCollection<DonorContribution>('aportes', (data) => {
      setDonorContributions(data);
    }, [], currentUser?.tenantId);

    const unsubLeaders = subscribeToCollection<Leader>('lideres', (data) => {
      setLeaders(data);
    }, [], currentUser?.tenantId);

    const unsubVehicles = subscribeToCollection<TransportVehicle>('vehiculos', (data) => {
      setVehicles(data);
    }, [], currentUser?.tenantId);

    const unsubDriveFiles = subscribeToCollection<DriveFileItem>('archivos_drive', (data) => {
      setDriveFiles(data);
    }, [], currentUser?.tenantId);

    const unsubCoordinations = subscribeToCollection<CampaignCoordination>('comites_coordinaciones', (data) => {
      setCoordinations(data);
    }, [], currentUser?.tenantId);

    const unsubDemo = currentUser?.tenantId
      ? subscribeToDemoCollection(currentUser.tenantId, setDemoBundle)
      : (() => { setDemoBundle(null); return () => {}; })();

    const voterManagers: UserRole[] = ['AdminGlobal', 'AdminTenant', 'Gobernador', 'Diputado', 'Alcalde', 'Concejal', 'JefePolitico'];
    const canReadVoters = currentUser && (voterManagers.includes(currentUser.role) || Boolean(currentUser.assignedLeaderId));
    const unsubGrassrootsVoters = canReadVoters
      ? subscribeToCollection<GrassrootsVoter>('votantes_rasos', (data) => setGrassrootsVoters(data), [], currentUser?.tenantId, voterManagers.includes(currentUser!.role) ? undefined : { field: 'leaderId', value: currentUser!.assignedLeaderId })
      : (() => { setGrassrootsVoters([]); return () => {}; })();

    return () => {
      unsubTenants();
      unsubUsers();
      unsubCandidates();
      unsubDistricts();
      unsubProposals();
      unsubExpenses();
      unsubAportes();
      unsubLeaders();
      unsubVehicles();
      unsubDriveFiles();
      unsubCoordinations();
      unsubDemo();
      unsubGrassrootsVoters();
    };
  }, [currentUser?.tenantId]);

  // Auth Handlers
  const handleLogin = (user: UserProfile) => {
    setCurrentUser(user);
    setUserRole(user.role);
    
    // Automatically isolate and switch tenant to the user's tenantId
    if (user.tenantId) {
      const foundTenant = tenants.find((t) => t.tenantId === user.tenantId);
      if (foundTenant) {
        setCurrentTenant(foundTenant);
      }
    }

    notifyFirestoreSave(
      `¡Bienvenido(a), ${user.prefix ? `${user.prefix} ` : ''}${user.displayName}! Espacio cargado para ${user.municipality || 'Astrea'}.`
    );
  };

  const handleRegisterUser = async (newUser: UserProfile) => {
    setUsers((prev) => [newUser, ...prev]);
    try {
      await saveUserToFirestore(newUser);
      notifyFirestoreSave(
        `Usuario ${newUser.prefix ? `${newUser.prefix} ` : ''}${newUser.displayName} creado y guardado en Firestore.`
      );
    } catch (e) {
      console.error('Error saving user to Firestore:', e);
    }
  };

  const handleUpdateProfile = async (updatedUser: UserProfile) => {
    await saveUserToFirestore(updatedUser);
    setCurrentUser(updatedUser);
    setUsers((current) => current.map((user) => user.uid === updatedUser.uid ? updatedUser : user));
    notifyFirestoreSave(`Perfil de ${updatedUser.displayName} actualizado correctamente.`);
  };

  const handleLogout = async () => {
    await logoutFirebaseAuth();
    setCurrentUser(null);
    setActiveTab('login');
    notifyFirestoreSave('Sesión cerrada. Seleccione o cree un usuario para continuar.');
  };

  // Drive scanning action
  const handleScanDrive = async () => {
    setDriveSyncing(false);
    setLastSyncStatus('Conecte Google Workspace con la cuenta de su organización.');
    setActiveTab('workspace');
  };

  // Add Handlers that persist directly to Firestore
  const handleAddTenant = async (newTenant: Tenant) => {
    try {
      const res = await seedNewTenantInitialData(newTenant);
      if (!res.success) throw new Error(res.message);
      setTenants((prev) => [...prev, newTenant]);
      setCurrentTenant(newTenant);
      notifyFirestoreSave(res.message);
    } catch (e) {
      console.error('Error saving tenant to Firestore:', e);
    }
  };

  const handleUpdateTenant = async (updatedTenant: Tenant) => {
    try {
      await saveTenantToFirestore(updatedTenant);
      setTenants((prev) => prev.map((t) => (t.tenantId === updatedTenant.tenantId ? updatedTenant : t)));
      if (currentTenant.tenantId === updatedTenant.tenantId) setCurrentTenant(updatedTenant);
      notifyFirestoreSave(`Parámetros de organización "${updatedTenant.name}" actualizados.`);
    } catch (e) {
      console.error('Error updating tenant in Firestore:', e);
    }
  };

  const handleDeleteTenant = async (tenantIdToDelete: string) => {
    const tenantToRemove = tenants.find((t) => t.tenantId === tenantIdToDelete);
    try {
      await deleteTenantFromFirestore(tenantIdToDelete);
      const updatedList = tenants.filter((t) => t.tenantId !== tenantIdToDelete);
      setTenants(updatedList);
      if (currentTenant.tenantId === tenantIdToDelete && updatedList.length > 0) setCurrentTenant(updatedList[0]);
      notifyFirestoreSave(`Partido / Organización "${tenantToRemove?.name || tenantIdToDelete}" eliminado de Firestore.`);
    } catch (e) {
      console.error('Error deleting tenant in Firestore:', e);
    }
  };

  const handleAddCandidate = async (newCandidate: Candidate) => {
    try {
      await saveCandidateToFirestore(newCandidate);
      setCandidates((prev) => [newCandidate, ...prev]);
      notifyFirestoreSave(`Candidato "${newCandidate.fullName}" guardado exitosamente en Firestore.`);
    } catch (e) {
      console.error('Error saving candidate to Firestore:', e);
    }
  };

  const handleAddProposal = async (newProposal: Proposal) => {
    try {
      await saveProposalToFirestore(newProposal);
      setProposals((prev) => [newProposal, ...prev]);
      notifyFirestoreSave(`Proyecto "${newProposal.title}" registrado en Firestore.`);
    } catch (e) {
      console.error('Error saving proposal to Firestore:', e);
    }
  };

  const handleAddExpense = async (newExpense: CampaignExpense) => {
    try {
      await saveExpenseToFirestore(newExpense);
      setExpenses((prev) => [newExpense, ...prev]);
      notifyFirestoreSave(`Gasto de $${newExpense.amount.toLocaleString('es-CO')} COP registrado en Firestore.`);
    } catch (e) {
      console.error('Error saving expense to Firestore:', e);
    }
  };

  const handleUpdateExpense = async (updatedExpense: CampaignExpense) => {
    if (updatedExpense.id.startsWith('demo-')) {
      setDemoError('Los registros demo son de solo lectura. Elimine y vuelva a crear la colección para restaurarlos.');
      return;
    }
    try {
      await saveExpenseToFirestore(updatedExpense);
      setExpenses((prev) => prev.map((e) => e.id === updatedExpense.id ? updatedExpense : e));
      notifyFirestoreSave(`Gasto "${updatedExpense.description}" actualizado en Firestore.`);
    } catch (e) {
      console.error('Error updating expense in Firestore:', e);
    }
  };

  const handleDeleteExpense = async (expenseId: string) => {
    if (expenseId.startsWith('demo-')) {
      setDemoError('Elimine la colección demo completa desde el control de presentación.');
      return;
    }
    try {
      await deleteExpenseFromFirestore(expenseId);
      setExpenses((prev) => prev.filter((e) => e.id !== expenseId));
      notifyFirestoreSave(`Gasto eliminado de Firestore.`);
    } catch (e) {
      console.error('Error deleting expense in Firestore:', e);
    }
  };

  const handleAddDonorContribution = async (newContribution: DonorContribution) => {
    try {
      await saveDonorContributionToFirestore(newContribution);
      setDonorContributions((prev) => [newContribution, ...prev]);
      notifyFirestoreSave(`Aporte de "${newContribution.donorName}" por $${newContribution.amount.toLocaleString('es-CO')} COP registrado en Firestore.`);
    } catch (e) {
      console.error('Error saving donor contribution to Firestore:', e);
    }
  };

  const handleAddLeader = async (newLeader: Leader) => {
    try {
      await saveLeaderToFirestore(newLeader);
      setLeaders((prev) => [newLeader, ...prev]);
      notifyFirestoreSave(`Líder veredal "${newLeader.fullName}" guardado en Firestore.`);
    } catch (e) {
      console.error('Error saving leader to Firestore:', e);
      throw e;
    }
  };

  const handleAddVehicle = async (newVehicle: TransportVehicle) => {
    try {
      await saveVehicleToFirestore(newVehicle);
      setVehicles((prev) => [newVehicle, ...prev]);
      notifyFirestoreSave(`Vehículo placa "${newVehicle.licensePlate}" registrado en Firestore.`);
    } catch (e) {
      console.error('Error saving vehicle to Firestore:', e);
      throw e;
    }
  };

  const handleAddGrassrootsVoter = async (newVoter: GrassrootsVoter) => {
    try {
      await saveGrassrootsVoterToFirestore(newVoter);
      setGrassrootsVoters((prev) => [newVoter, ...prev]);
      notifyFirestoreSave(`Votante ${newVoter.fullName} registrado(a) y consolidado en la jerarquía electoral.`);
    } catch (e) {
      console.error('Error saving grassroots voter to Firestore:', e);
    }
  };

  const handleUpdateCoordination = async (updatedCoordination: CampaignCoordination) => {
    if (updatedCoordination.id.startsWith('demo-')) {
      setDemoError('La estructura demo es de solo lectura y permanece aislada de la operación real.');
      return;
    }
    try {
      await saveCoordinationToFirestore(updatedCoordination);
      setCoordinations((prev) => prev.map((c) => c.id === updatedCoordination.id ? updatedCoordination : c));
      notifyFirestoreSave(`Comité "${updatedCoordination.title}" actualizado.`);
    } catch (e) {
      console.error('Error updating coordination in Firestore:', e);
    }
  };

  const handleCreateDemo = async () => {
    setDemoBusy(true);
    setDemoError(null);
    try {
      const bundle = await createDemoCollection(currentTenant.tenantId);
      setDemoBundle(bundle);
      notifyFirestoreSave('Colección demo creada en Firestore. Todos los registros mostrados son ficticios.');
    } catch (error) {
      console.warn('Advertencia al sincronizar demo en nube:', error);
      // Fallback: build bundle locally so the presentation mode is instantly active
      const localBundle = buildDemoBundle(currentTenant.tenantId);
      setDemoBundle(localBundle);
      notifyFirestoreSave('Modo presentación demo activado correctamente.');
    } finally {
      setDemoBusy(false);
    }
  };

  const handleDeleteDemo = async () => {
    setDemoBusy(true);
    setDemoError(null);
    try {
      await deleteDemoCollection(currentTenant.tenantId);
      setDemoBundle(null);
      notifyFirestoreSave('Colección demo eliminada. Los datos operativos reales no fueron modificados.');
    } catch (error) {
      const message = error instanceof Error ? error.message : 'No fue posible eliminar la colección demo.';
      setDemoError(message);
    } finally {
      setDemoBusy(false);
    }
  };

  // Navigation shortcuts from sub-views
  const handleGenerateSpeechForCandidate = (candName: string, district: string, chamber: string) => {
    setActiveTab('ai');
  };

  const handleGenerateDistrictStrategy = (districtName: string, keyIssues: string[]) => {
    setActiveTab('ai');
  };

  const handleAnalyzeProposalWithAi = (title: string, summary: string) => {
    setActiveTab('ai');
  };

  const handleAnalyzeDriveFileWithAi = async (file: DriveFileItem) => {
    setActiveTab('ai');
  };

  const realDataCount = candidates.length + districts.length + proposals.length + driveFiles.length
    + expenses.length + donorContributions.length + leaders.length + vehicles.length
    + coordinations.length + grassrootsVoters.length;
  const demoActive = realDataCount === 0 && Boolean(demoBundle);
  const visibleCandidates = demoActive ? demoBundle!.candidates : candidates;
  const visibleDistricts = demoActive ? demoBundle!.districts : districts;
  const visibleProposals = demoActive ? demoBundle!.proposals : proposals;
  const visibleDriveFiles = demoActive ? demoBundle!.driveFiles : driveFiles;
  const visibleExpenses = demoActive ? demoBundle!.expenses : expenses;
  const visibleContributions = demoActive ? demoBundle!.contributions : donorContributions;
  const visibleLeaders = demoActive ? demoBundle!.leaders : leaders;
  const visibleVehicles = demoActive ? demoBundle!.vehicles : vehicles;
  const visibleCoordinations = demoActive ? demoBundle!.coordinations : coordinations;
  const visibleVoters = demoActive ? demoBundle!.voters : grassrootsVoters;
  const canManageDemo = ['AdminGlobal', 'AdminTenant', 'Gobernador', 'Diputado', 'Alcalde', 'Concejal', 'JefePolitico'].includes(userRole);

  if (!currentUser) {
    if (showPublicDemo) {
      return (
        <div className="min-h-screen bg-[#030712] text-slate-100 relative isolate overflow-x-hidden">
          {/* Living Interactive Synaptic Neural Background */}
          <SynapticNeuralBackground interactive={true} />

          <header className="sticky top-0 z-20 border-b border-cyan-500/20 bg-slate-950/90 px-4 py-3 backdrop-blur-xl shadow-lg">
            <div className="mx-auto flex max-w-7xl flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <div className="flex items-center gap-2">
                  <p className="text-xs font-black uppercase tracking-[0.2em] text-cyan-300">Presentación interactiva</p>
                  <span className="text-[10px] bg-slate-900 text-slate-400 border border-slate-700 px-2 py-0.5 rounded-full font-mono">Modo Auditoría</span>
                </div>
                <h1 className="text-lg font-black text-white">Astrea Suite Electoral</h1>
                <p className="text-xs text-slate-400">Todos los nombres, documentos y valores de esta vista son ficticios.</p>
              </div>
              <div className="flex gap-2">
                <div className="flex rounded-xl border border-cyan-500/25 bg-slate-950/80 p-1">
                  <button type="button" onClick={() => setPublicDemoView('dashboard')} className={`flex items-center gap-2 rounded-lg px-3 py-1.5 text-xs font-bold transition cursor-pointer ${publicDemoView === 'dashboard' ? 'bg-cyan-500/20 text-cyan-200' : 'text-slate-400 hover:text-white'}`}>
                    <LayoutDashboard className="h-3.5 w-3.5" /> Tablero
                  </button>
                  <button type="button" onClick={() => setPublicDemoView('map')} className={`flex items-center gap-2 rounded-lg px-3 py-1.5 text-xs font-bold transition cursor-pointer ${publicDemoView === 'map' ? 'bg-cyan-500/20 text-cyan-200' : 'text-slate-400 hover:text-white'}`}>
                    <MapPinned className="h-3.5 w-3.5" /> Mapa
                  </button>
                </div>
                <button type="button" onClick={() => setShowPublicDemo(false)} className="flex items-center gap-2 rounded-xl border border-slate-700 bg-slate-900/80 px-4 py-2 text-xs font-bold text-slate-200 hover:bg-slate-800 transition cursor-pointer">
                  <ArrowLeft className="h-4 w-4" /> Inicio
                </button>
                <button type="button" onClick={() => { setShowPublicDemo(false); setActiveTab('login'); }} className="flex items-center gap-2 rounded-xl bg-gradient-to-r from-cyan-600 to-blue-600 hover:from-cyan-500 hover:to-blue-500 px-4 py-2 text-xs font-black text-white shadow-lg shadow-cyan-950/50 transition cursor-pointer">
                  <LogIn className="h-4 w-4" /> Iniciar sesión
                </button>
              </div>
            </div>
          </header>
          <main className="mx-auto max-w-7xl p-3 sm:p-6 lg:p-8">
            <Suspense fallback={<div className="p-10 text-center text-sm text-slate-400">Cargando presentación…</div>}>
              {publicDemoView === 'dashboard' ? (
            <div className="space-y-4"><AdministrativeOverview tenantId={PUBLIC_DEMO_TENANT.tenantId} expenses={PUBLIC_DEMO_DATA.expenses} /><details className="rounded-xl border border-slate-800 p-3"><summary className="cursor-pointer text-sm font-bold text-cyan-300">Otros indicadores</summary><div className="mt-3">
                <DashboardView
                  currentTenant={PUBLIC_DEMO_TENANT}
                  currentUser={PUBLIC_DEMO_USER}
                  userRole="Consulta"
                  candidates={PUBLIC_DEMO_DATA.candidates}
                  districts={PUBLIC_DEMO_DATA.districts}
                  proposals={PUBLIC_DEMO_DATA.proposals}
                  driveFiles={PUBLIC_DEMO_DATA.driveFiles}
                  expenses={PUBLIC_DEMO_DATA.expenses}
                  contributions={PUBLIC_DEMO_DATA.contributions}
                  leaders={PUBLIC_DEMO_DATA.leaders}
                  vehicles={PUBLIC_DEMO_DATA.vehicles}
                  voters={PUBLIC_DEMO_DATA.voters}
                  onNavigateTab={() => {}}
                />

            </div></details></div>
              ) : (
                <TerritorialMapView
                  leaders={PUBLIC_DEMO_DATA.leaders}
                  vehicles={PUBLIC_DEMO_DATA.vehicles}
                  tenantName={PUBLIC_DEMO_TENANT.name}
                  currentTenant={PUBLIC_DEMO_TENANT}
                  currentUser={PUBLIC_DEMO_USER}
                  userRole="Consulta"
                />
              )}
            </Suspense>
          </main>
        </div>
      );
    }
    if (activeTab !== 'login') {
      return <LandingPage onEnterLogin={() => setActiveTab('login')} onOpenDemo={() => setShowPublicDemo(true)} tenantName={currentTenant.name || 'Astrea'} />;
    }
    return (
      <LoginView 
        users={users} 
        currentUser={null} 
        tenants={tenants} 
        currentTenant={currentTenant} 
        onLogin={handleLogin} 
        onRegister={handleRegisterUser} 
        onLogout={handleLogout} 
        onContinueToApp={() => setActiveTab('dashboard')} 
        onBackToLanding={() => setActiveTab('dashboard')}
      />
    );
  }

  return (
    <div className="min-h-screen bg-[#030712] text-slate-100 flex flex-col font-sans antialiased selection:bg-cyan-500 selection:text-white relative isolate overflow-x-hidden">
      
      {/* Living Interactive Synaptic Neural Background with Fluid Physics */}
      <SynapticNeuralBackground interactive={true} />

      {/* Cybernetic Dot Grid Background */}
      <div className="absolute inset-0 -z-10 opacity-30 [background-size:40px_40px] [background-image:linear-gradient(rgba(34,211,238,.04)_1px,transparent_1px),linear-gradient(90deg,rgba(34,211,238,.04)_1px,transparent_1px)] pointer-events-none" />

      {/* Top Navigation Header with Streamlined Toolbar & Profile Pill */}
      <Header
        tenants={tenants}
        currentTenant={currentTenant}
        onSelectTenant={setCurrentTenant}
        onNavigateToTenants={() => setActiveTab('tenants')}
        currentUser={currentUser}
        onOpenAuthModal={() => setShowAuthModal(true)}
        userRole={userRole}
        onSelectRole={setUserRole}
      />

      {/* Main Body Layout */}
      <div className="flex-1 flex flex-col md:flex-row">
        
        {/* Sidebar */}
        <Sidebar
          activeTab={activeTab}
          onTabChange={setActiveTab}
          driveFileCount={visibleDriveFiles.length}
          candidateCount={visibleCandidates.filter((c) => c.tenantId === currentTenant.tenantId).length}
          leaderCount={visibleLeaders.filter((l) => l.tenantId === currentTenant.tenantId).length}
          vehicleCount={visibleVehicles.filter((v) => v.tenantId === currentTenant.tenantId).length}
          voterCount={visibleVoters.filter((v) => v.tenantId === currentTenant.tenantId).length}
          currentUser={currentUser}
          userRole={userRole}
          onLogout={handleLogout}
        />

        {/* Content Area */}
        <main className="min-w-0 flex-1 p-3 pb-24 md:pb-6 sm:p-4 lg:p-5 mx-auto w-full space-y-3">
          
          {/* Personalized User Recognition & Salutation Banner */}
          {currentUser && activeTab !== 'login' && (
            <UserGreetingBanner
              currentUser={currentUser}
              currentTenant={currentTenant}
              onOpenAuthModal={() => setShowAuthModal(true)}
              onUpdateUserName={(newName) => {
                setCurrentUser((user) => user ? { ...user, displayName: newName, fullName: newName } : null);
                setUsers((current) => current.map((user) => user.uid === currentUser.uid ? { ...user, displayName: newName, fullName: newName } : user));
              }}
            />
          )}

          {currentUser && activeTab !== 'login' && (realDataCount === 0 || demoBundle) && (
            <details className="rounded-xl border border-slate-700 bg-slate-900/80 px-3 py-2 text-xs">
              <summary className="cursor-pointer font-bold text-cyan-200">{demoActive ? 'Datos demo' : 'Datos'} · {currentTenant.name}</summary>
              <div className="mt-3 flex flex-wrap items-center gap-3">
                <span className="text-slate-400">{demoActive ? 'Demostración · datos ficticios' : 'Datos operativos'}</span>
                {!demoBundle && <button disabled={demoBusy} onClick={handleCreateDemo} className="rounded-lg bg-cyan-700 px-3 py-2 text-white">{demoBusy ? 'Creando…' : 'Crear demo'}</button>}
                {demoBundle && canManageDemo && <button disabled={demoBusy} onClick={handleDeleteDemo} className="rounded-lg bg-rose-950 px-3 py-2 text-rose-200">{demoBusy ? 'Eliminando…' : 'Eliminar demo'}</button>}
                {demoError && <span role="alert" className="text-rose-300">{demoError}</span>}
              </div>
            </details>
          )}

          {/* Real-time Save Toast Notification */}
          {firestoreSyncNotice && (
            <div className="bg-slate-950/95 border border-cyan-500/40 rounded-2xl px-5 py-3.5 flex items-center justify-between text-xs text-cyan-200 shadow-2xl shadow-cyan-950/50 backdrop-blur-xl animate-fade-in">
              <div className="flex items-center gap-2.5">
                <CheckCircle2 className="w-4 h-4 text-cyan-400 shrink-0 animate-pulse" />
                <span className="font-semibold text-white">{firestoreSyncNotice}</span>
              </div>
              <span className="text-[10px] text-cyan-400 font-mono bg-cyan-950/70 border border-cyan-500/30 px-2 py-0.5 rounded-md">
                Firestore Cloud Sincronizado
              </span>
            </div>
          )}

          {/* Clean Organization Status Bar */}
          {activeTab !== 'login' && (
            <div className="bg-slate-950/80 border border-cyan-500/20 rounded-2xl px-4 py-2.5 flex flex-col sm:flex-row sm:items-center justify-between gap-2.5 text-xs text-slate-400 shadow-md backdrop-blur-md">
              <div className="flex items-center gap-2.5">
                <span className="w-2.5 h-2.5 rounded-full bg-cyan-400 animate-pulse"></span>
                <span className="font-bold text-slate-200"><strong className="text-white">{currentTenant.name}</strong></span>
              </div>
              
              <div className="flex items-center gap-3">
                <button
                  onClick={() => setShowFirestoreModal(true)}
                  className="flex items-center gap-1.5 text-cyan-300 hover:text-white bg-cyan-500/10 hover:bg-cyan-500/20 px-3 py-1 rounded-xl border border-cyan-500/30 font-bold transition cursor-pointer shadow-sm"
                >
                  <Database className="w-3.5 h-3.5 text-cyan-400" />
                  <span>Datos</span>
                </button>
                
              </div>
            </div>
          )}

          {/* Quick Universal Return / Navigation Bar when in Sub-Views */}
          {currentUser && activeTab !== 'dashboard' && activeTab !== 'login' && (
            <div className="bg-slate-900/90 border border-slate-800/80 rounded-2xl p-3 sm:px-4 sm:py-2.5 flex flex-col sm:flex-row sm:items-center justify-between gap-2.5 shadow-md animate-fade-in">
              <button
                type="button"
                id="global-back-to-dashboard-btn"
                onClick={() => setActiveTab('dashboard')}
                className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-xl bg-blue-600/10 hover:bg-blue-600/20 text-blue-400 hover:text-blue-300 border border-blue-500/30 font-bold text-xs transition cursor-pointer shadow-sm w-fit"
                title="Regresar a la pantalla principal del Centro de Control"
              >
                <ArrowLeft className="w-4 h-4" />
                <span>← Volver al Centro de Control (Dashboard)</span>
              </button>
              <div className="flex items-center gap-2 text-xs text-slate-400">
                <span className="text-[11px] text-slate-400">Módulo actual:</span>
                <span className="text-white font-bold bg-slate-800 px-2.5 py-1 rounded-lg border border-slate-700 text-[11px]">
                  {activeTab === 'campaign_structure' ? 'Estructura & Comités' :
                   activeTab === 'hierarchy_pyramid' ? 'Base Territorial & Votantes' :
                   activeTab === 'leaders' ? 'Líderes y Metas' :
                   activeTab === 'ingestion' ? 'Ingesta Masiva & Audio IA' :
                   activeTab === 'map' ? 'Mapa Territorial' :
                   activeTab === 'transport' ? 'Logística Día D' :
                   activeTab === 'finances' ? 'Finanzas y Aportes' :
                   activeTab === 'costs_report' ? 'Control de Gastos' :
                   activeTab === 'candidates' ? 'Candidaturas' :
                   activeTab === 'districts' ? 'Territorios y Censo' :
                   activeTab === 'proposals' ? 'Programa de Gobierno' :
                   activeTab === 'workspace' ? 'Google Workspace' :
                   activeTab === 'drive' ? 'Archivo Documental' :
                   activeTab === 'zone_projections' ? 'Proyección Territorial' :
                   activeTab === 'simulator' ? 'Simulador Electoral' :
                   activeTab === 'ai' ? 'Asistente IA' :
                   activeTab === 'tenants' ? 'Organizaciones' : activeTab}
                </span>
              </div>
            </div>
          )}

          {/* Dedicated Login View */}
          {(activeTab === 'login' || !currentUser) && (
            <LoginView
              users={users}
              currentUser={currentUser}
              tenants={tenants}
              currentTenant={currentTenant}
              onLogin={handleLogin}
              onRegister={handleRegisterUser}
              onLogout={handleLogout}
              onContinueToApp={() => setActiveTab('dashboard')}
            />
          )}

          {/* Tab Views: each module is loaded only when the user opens it. */}
          <Suspense fallback={(
            <div className="min-h-[45vh] flex items-center justify-center" role="status" aria-live="polite">
              <div className="flex items-center gap-3 rounded-xl border border-slate-800 bg-slate-900/70 px-5 py-4 text-sm text-slate-300">
                <RefreshCw className="h-4 w-4 animate-spin text-blue-400" />
                Cargando módulo…
              </div>
            </div>
          )}>
          {currentUser && activeTab === 'dashboard' && (
            <div className="space-y-4"><AdministrativeOverview tenantId={currentTenant.tenantId} expenses={visibleExpenses} /><details className="rounded-xl border border-slate-800 p-3"><summary className="cursor-pointer text-sm font-bold text-cyan-300">Otros indicadores</summary><div className="mt-3">
            <DashboardView
              currentTenant={currentTenant}
              currentUser={currentUser}
              userRole={userRole}
              candidates={visibleCandidates}
              districts={visibleDistricts}
              proposals={visibleProposals}
              driveFiles={visibleDriveFiles}
              expenses={visibleExpenses}
              contributions={visibleContributions}
              leaders={visibleLeaders}
              vehicles={visibleVehicles}
              voters={visibleVoters}
              onNavigateTab={setActiveTab}
            />

            </div></details></div>
          )}

          {currentUser && activeTab === 'campaign_structure' && (
            <CampaignStructureView
              currentTenant={currentTenant}
              currentUser={currentUser}
              userRole={userRole}
              coordinations={visibleCoordinations}
              onUpdateCoordination={handleUpdateCoordination}
              onNavigateTab={setActiveTab}
            />
          )}

          {currentUser && activeTab === 'hierarchy_pyramid' && (
            <ElectoralHierarchyRollupView
              currentTenant={currentTenant}
              currentUser={currentUser}
              userRole={userRole}
              grassrootsVoters={visibleVoters}
              leaders={visibleLeaders}
              candidates={visibleCandidates}
              onAddVoter={handleAddGrassrootsVoter}
            />
          )}

          {currentUser && activeTab === 'simulator' && (
            <ElectoralSimulatorView
              currentTenant={currentTenant}
              candidates={visibleCandidates}
              onNavigateTab={setActiveTab}
            />
          )}

          {currentUser && activeTab === 'costs_report' && (
            <CampaignCostsReportView
              currentTenant={currentTenant}
              userRole={userRole}
              expenses={visibleExpenses}
              leaders={visibleLeaders}
              vehicles={visibleVehicles}
              donorContributions={visibleContributions}
              onAddExpense={handleAddExpense}
              onUpdateExpense={handleUpdateExpense}
              onDeleteExpense={handleDeleteExpense}
              onNavigateTab={setActiveTab}
            />
          )}

          {currentUser && activeTab === 'zone_projections' && (
            <ZoneElectoralProjectionView
              currentTenant={currentTenant}
              currentUser={currentUser}
              userRole={userRole}
              leaders={visibleLeaders.filter((l) => l.tenantId === currentTenant.tenantId)}
              expenses={visibleExpenses.filter((e) => e.tenantId === currentTenant.tenantId)}
              vehicles={visibleVehicles.filter((v) => v.tenantId === currentTenant.tenantId)}
              candidates={visibleCandidates.filter((c) => c.tenantId === currentTenant.tenantId)}
            />
          )}

          {currentUser && activeTab === 'workspace' && (
            <GoogleWorkspaceHubView
              tenantName={currentTenant.name}
              tenantId={currentTenant.tenantId}
              expenses={visibleExpenses.filter((e) => e.tenantId === currentTenant.tenantId)}
              leaders={visibleLeaders.filter((l) => l.tenantId === currentTenant.tenantId)}
              vehicles={visibleVehicles.filter((v) => v.tenantId === currentTenant.tenantId)}
              candidates={visibleCandidates.filter((c) => c.tenantId === currentTenant.tenantId)}
            />
          )}

          {currentUser && activeTab === 'map' && (
            <TerritorialMapView
              leaders={visibleLeaders.filter((l) => l.tenantId === currentTenant.tenantId)}
              vehicles={visibleVehicles.filter((v) => v.tenantId === currentTenant.tenantId)}
              tenantName={currentTenant.name}
              currentTenant={currentTenant}
              currentUser={currentUser}
              userRole={userRole}
            />
          )}

          {currentUser && activeTab === 'finances' && (
            <FinancesView
              currentTenant={currentTenant}
              currentUser={currentUser}
              userRole={userRole}
              expenses={visibleExpenses}
              donorContributions={visibleContributions}
              onAddExpense={handleAddExpense}
              onAddDonorContribution={handleAddDonorContribution}
              onNavigateTransport={() => setActiveTab('transport')}
            />
          )}

          {currentUser && activeTab === 'leaders' && (
            <LeadersView
              currentTenant={currentTenant}
              currentUser={currentUser}
              userRole={userRole}
              leaders={visibleLeaders}
              onAddLeader={handleAddLeader}
            />
          )}

          {currentUser && activeTab === 'ingestion' && (
            <UniversalDataIngestionView
              currentTenant={currentTenant}
              currentUser={currentUser}
              onLeaderAdded={handleAddLeader}
              onExpenseAdded={handleAddExpense}
              onBatchIngested={(entity, count) => {
                notifyFirestoreSave(`Sincronizados ${count} registros de ${entity} en Firestore.`);
              }}
            />
          )}

          {currentUser && activeTab === 'transport' && (
            <TransportView
              currentTenant={currentTenant}
              currentUser={currentUser}
              userRole={userRole}
              vehicles={visibleVehicles}
              onAddVehicle={handleAddVehicle}
            />
          )}

          {currentUser && activeTab === 'candidates' && (
            <CandidatesView
              currentTenant={currentTenant}
              currentUser={currentUser}
              userRole={userRole}
              candidates={visibleCandidates}
              onAddCandidate={handleAddCandidate}
              onGenerateSpeechForCandidate={handleGenerateSpeechForCandidate}
            />
          )}

          {currentUser && activeTab === 'districts' && (
            <DistrictsView
              currentTenant={currentTenant}
              districts={visibleDistricts}
              onGenerateDistrictStrategy={handleGenerateDistrictStrategy}
            />
          )}

          {currentUser && activeTab === 'proposals' && (
            <ProposalsView
              currentTenant={currentTenant}
              proposals={visibleProposals}
              onAddProposal={handleAddProposal}
              onAnalyzeProposalWithAi={handleAnalyzeProposalWithAi}
            />
          )}

          {currentUser && activeTab === 'drive' && (
            <DriveView
              currentTenant={currentTenant}
              driveFiles={visibleDriveFiles}
              driveSyncing={driveSyncing}
              onScanDrive={handleScanDrive}
              onAnalyzeDriveFileWithAi={handleAnalyzeDriveFileWithAi}
            />
          )}

          {currentUser && activeTab === 'ai' && (
            <AiAssistantView
              currentTenant={currentTenant}
              candidates={visibleCandidates}
              districts={visibleDistricts}
              proposals={visibleProposals}
              driveFiles={visibleDriveFiles}
            />
          )}

          {currentUser && activeTab === 'tenants' && (
            <TenantsView
              tenants={tenants}
              currentTenant={currentTenant}
              onSelectTenant={setCurrentTenant}
              onAddTenant={handleAddTenant}
              onUpdateTenant={handleUpdateTenant}
              onDeleteTenant={handleDeleteTenant}
              userRole={userRole}
              users={users}
              candidates={candidates}
              expenses={expenses}
              leaders={leaders}
              vehicles={vehicles}
              donorContributions={donorContributions}
            />
          )}
          </Suspense>

        </main>

      </div>

      {/* Auth & User Management Modal */}
      <AuthModal
        isOpen={showAuthModal}
        onClose={() => setShowAuthModal(false)}
        users={users}
        currentUser={currentUser}
        tenants={tenants}
        onLogin={handleLogin}
        onRegister={handleRegisterUser}
        onUpdateProfile={handleUpdateProfile}
        onLogout={handleLogout}
      />

      {/* Firestore Verification & Seeding Modal */}
      <FirestoreStatusModal
        isOpen={showFirestoreModal}
        onClose={() => setShowFirestoreModal(false)}
        onRefreshData={() => {
          notifyFirestoreSave('Datos de Colombia actualizados desde Firestore.');
        }}
      />

      {/* Footer */}
      <footer className="bg-slate-950 border-t border-slate-900 py-4 px-6 text-center text-xs text-slate-500">
        <p>Astrea Suite Electoral • Arquitectura multi-tenant • Operación, administración e inteligencia estadística</p>
        <p className="mt-1 text-slate-400">Desarrollada por Wilson José Arias</p>
      </footer>

    </div>
  );
}
