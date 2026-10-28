import {DemoEditing} from './components/common/EditRecordButton';
import {DemoDataEditor} from './components/DemoDataEditor';
import {saveDemoEntity,deleteDemoExpense} from './lib/demoWorkspace';
import React, { lazy, Suspense, useState, useEffect, useRef } from 'react';
import { EditRecordButton } from './components/common/EditRecordButton';
import { OperationsEditingReferences } from './components/operations/OperationsEditingReferences';
import { OperationsProvider } from './components/operations/OperationsContext';
const OperationsOverview = lazy(()=>import('./components/operations/OperationsOverview').then(m=>({default:m.OperationsOverview})));
const ResourcesView = lazy(()=>import('./components/operations/ResourcesView').then(m=>({default:m.ResourcesView})));
import { DevicePersistencePanel } from './components/DevicePersistence';
import { RouteTrackingProvider } from './components/RouteTrackingProvider';
import {isTrackingAdministrator} from './lib/trackingPermissions';
import {keepViewedTenant, type ViewerScope} from './lib/tenantSelection';
const RouteOperationsView = lazy(()=>import('./components/RouteOperationsView').then(module=>({default:module.RouteOperationsView})));
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
  saveGrassrootsVoterToFirestore,
  saveCoordinationToFirestore,
  createDemoCollection,
  deleteDemoCollection,
  subscribeToDemoCollection
} from './lib/firebase';
import { buildDemoBundle, type DemoBundle } from './data/demoSeed';
import { demoMatchesProfile } from './data/contextualDemo';
import { COLOMBIA_ELECTORAL_GEOGRAPHY } from './data/colombiaElectoralData';
import { logoutFirebaseAuth, observeAuthenticatedProfile } from './lib/firebaseAuth';
import { UserManagementView } from './components/UserManagementView';
import { Header } from './components/Header';
import { Sidebar, ActiveTab } from './components/Sidebar';
import { AuthModal } from './components/AuthModal';
import { LoginView } from './components/LoginView';
import { LandingPage } from './components/LandingPage';
import { SynapticNeuralBackground } from './components/SynapticNeuralBackground';
import { UserGreetingBanner } from './components/UserGreetingBanner';
import { ArrowLeft, LogIn, Sparkles, CheckCircle2, AlertCircle, RefreshCw } from 'lucide-react';

const DashboardView = lazy(() => import('./components/DashboardView').then(module => ({ default: module.DashboardView })));
const AdministrativeOverview = lazy(() => import('./components/AdministrativeOverview').then(module => ({ default: module.AdministrativeOverview })));
const CampaignStructureView = lazy(() => import('./components/CampaignStructureView').then(module => ({ default: module.CampaignStructureView })));
const ElectoralHierarchyRollupView = lazy(() => import('./components/ElectoralHierarchyRollupView').then(module => ({ default: module.ElectoralHierarchyRollupView })));
const ElectoralSimulatorView = lazy(() => import('./components/ElectoralSimulatorView').then(module => ({ default: module.ElectoralSimulatorView })));
const CampaignCostsReportView = lazy(() => import('./components/CampaignCostsReportView').then(module => ({ default: module.CampaignCostsReportView })));
const ZoneElectoralProjectionView = lazy(() => import('./components/ZoneElectoralProjectionView').then(module => ({ default: module.ZoneElectoralProjectionView })));
const FinancesView = lazy(() => import('./components/FinancesView').then(module => ({ default: module.FinancesView })));
const LeadersView = lazy(() => import('./components/LeadersView').then(module => ({ default: module.LeadersView })));
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
const PUBLIC_DEMO_DATA = buildDemoBundle(PUBLIC_DEMO_TENANT.tenantId,{uid:'demo-publico',email:'presentacion@demo.invalid',displayName:'Visitante Demo',tenantId:PUBLIC_DEMO_TENANT.tenantId,role:'AdminTenant',department:'Cesar',municipality:'Astrea',createdAt:new Date().toISOString()});
const PUBLIC_DEMO_USER: UserProfile = { uid: 'demo-publico', email: 'presentacion@demo.invalid', displayName: 'Visitante Demo', tenantId: PUBLIC_DEMO_TENANT.tenantId, role: 'Consulta', municipality: 'Cesar', department: 'Cesar', createdAt: '2026-08-15T12:00:00.000Z', active: true };

export default function App() {
  const [tenants, setTenants] = useState<Tenant[]>([]);
  const [currentTenant, setCurrentTenant] = useState<Tenant>(EMPTY_TENANT);
  const [users, setUsers] = useState<UserProfile[]>([]);

  const [currentUser, setCurrentUser] = useState<UserProfile | null>(null);
  const observedViewer = useRef<ViewerScope | null>(null);
  const userRole: UserRole = currentUser?.role || 'Consulta';
  const selectedTenantId = currentUser?.role === 'AdminGlobal' ? currentTenant.tenantId : currentUser?.tenantId;

  const [activeTab, setActiveTab] = useState<ActiveTab>('dashboard');
  const [routeToOpen,setRouteToOpen]=useState('');
  useEffect(()=>{if(activeTab!=='routes')setRouteToOpen('');},[activeTab]);

  // Auth modal state
  const [showAuthModal, setShowAuthModal] = useState<boolean>(false);
  const [showPublicDemo, setShowPublicDemo] = useState<boolean>(false);

  // Firestore modal state
  const [firestoreSyncNotice, setFirestoreSyncNotice] = useState<string | null>(null);

  // Collections state
  const [candidates, setCandidates] = useState<Candidate[]>([]);
  const [districts, setDistricts] = useState<District[]>([]);
  const [proposals, setProposals] = useState<Proposal[]>([]);
  const [driveFiles, setDriveFiles] = useState<DriveFileItem[]>([]);

  // Campaign operational & finance state
  const [showOperationalDetails, setShowOperationalDetails] = useState(false);
  const [expenses, setExpenses] = useState<CampaignExpense[]>([]);
  const [donorContributions, setDonorContributions] = useState<DonorContribution[]>([]);
  const [leaders, setLeaders] = useState<Leader[]>([]);
  const [vehicles, setVehicles] = useState<TransportVehicle[]>([]);
  const [coordinations, setCoordinations] = useState<CampaignCoordination[]>([]);
  const [grassrootsVoters, setGrassrootsVoters] = useState<GrassrootsVoter[]>([]);
  const [demoBundle, setDemoBundle] = useState<DemoBundle | null>(null);
  const [demoBusy, setDemoBusy] = useState(false);
  const [demoError, setDemoError] = useState<string | null>(null);
  const [demoEnabled, setDemoEnabledState] = useState(false);
  function setDemoEnabled(value:boolean){setDemoEnabledState(value);if(currentUser)try{localStorage.setItem('astrea:demo-visible:'+currentUser.uid+':'+selectedTenantId,String(value));}catch{/* The cloud records remain saved. */}}

  const [demoDepartment, setDemoDepartment] = useState('');
  const [demoMunicipality, setDemoMunicipality] = useState('');
  useEffect(() => {
    try{setDemoEnabledState(currentUser?localStorage.getItem('astrea:demo-visible:'+currentUser.uid+':'+selectedTenantId)==='true':false);}catch{setDemoEnabledState(false);} setDemoBundle(null); setDemoError(null);
    setDemoDepartment(currentUser?.department?.trim() || '');
    setDemoMunicipality(currentUser?.municipality?.trim() || '');
  }, [currentUser?.uid, selectedTenantId, currentUser?.role, currentUser?.department, currentUser?.municipality, currentUser?.electoralLevel]);

  // Drive sync state
  const [driveSyncing, setDriveSyncing] = useState<boolean>(false);

  // Flash notification helper
  const notifyFirestoreSave = (msg: string) => {
    setFirestoreSyncNotice(msg);
    setTimeout(() => setFirestoreSyncNotice(null), 4000);
  };

  useEffect(() => {
    return observeAuthenticatedProfile((profile) => {
      const keepSelection = keepViewedTenant(observedViewer.current, profile);
      observedViewer.current = profile ? {uid: profile.uid, role: profile.role, tenantId: profile.tenantId} : null;
      setCurrentUser(profile);
      if (profile?.tenantId) {
        setCurrentTenant((tenant) => (keepSelection && tenant.tenantId) || tenant.tenantId === profile.tenantId ? tenant : { ...EMPTY_TENANT, tenantId: profile.tenantId });
      } else setCurrentTenant(EMPTY_TENANT);
    });
  }, []);

  // Real-time Firestore subscriptions for all active collections in Spanish
  useEffect(() => {
    const unsubTenants = subscribeToCollection<Tenant>('organizaciones', (data) => {
      setTenants(data);
      if (data && data.length > 0) {
        // Ensure current tenant remains valid
        setCurrentTenant((prev) => data.find((t) => t.tenantId === prev.tenantId) || data[0]);
      }
    }, [], currentUser?.tenantId, undefined, currentUser?.role === 'AdminGlobal');

    const managers: UserRole[] = ['AdminGlobal', 'AdminTenant', 'Gobernador', 'Diputado', 'Alcalde', 'Concejal', 'JefePolitico'];
    const unsubUsers = currentUser && managers.includes(currentUser.role)
      ? subscribeToCollection<UserProfile>('usuarios', setUsers, [], selectedTenantId)
      : (() => { setUsers(currentUser ? [currentUser] : []); return () => {}; })();

    const unsubCandidates = subscribeToCollection<Candidate>('candidatos', (data) => {
      setCandidates(data);
    }, [], selectedTenantId);

    const unsubDistricts = subscribeToCollection<District>('distritos', (data) => {
      setDistricts(data);
    }, [], selectedTenantId);

    const unsubProposals = subscribeToCollection<Proposal>('propuestas', (data) => {
      setProposals(data);
    }, [], selectedTenantId);

    const unsubExpenses = subscribeToCollection<CampaignExpense>('gastos', (data) => {
      setExpenses(data);
    }, [], selectedTenantId);

    const unsubAportes = subscribeToCollection<DonorContribution>('aportes', (data) => {
      setDonorContributions(data);
    }, [], selectedTenantId);

    const unsubLeaders = subscribeToCollection<Leader>('lideres', (data) => {
      setLeaders(data);
    }, [], selectedTenantId);

    const unsubVehicles = subscribeToCollection<TransportVehicle>('vehiculos', (data) => {
      setVehicles(data);
    }, [], selectedTenantId);

    const unsubDriveFiles = subscribeToCollection<DriveFileItem>('archivos_drive', (data) => {
      setDriveFiles(data);
    }, [], selectedTenantId);

    const unsubCoordinations = subscribeToCollection<CampaignCoordination>('comites_coordinaciones', (data) => {
      setCoordinations(data);
    }, [], selectedTenantId);

    const unsubDemo = selectedTenantId && currentUser
      ? subscribeToDemoCollection(selectedTenantId, currentUser.uid, setDemoBundle, setDemoError)
      : (() => { setDemoBundle(null); return () => {}; })();

    const voterManagers: UserRole[] = ['AdminGlobal', 'AdminTenant', 'Gobernador', 'Diputado', 'Alcalde', 'JefePolitico'];
    const canReadVoters = !!currentUser;
    const unsubGrassrootsVoters = canReadVoters
      ? subscribeToCollection<GrassrootsVoter>('votantes_rasos', setGrassrootsVoters, [], selectedTenantId, voterManagers.includes(currentUser!.role) ? undefined : currentUser!.role === 'Concejal' && currentUser!.assignedCandidateId ? { field: 'candidateId', value: currentUser!.assignedCandidateId } : currentUser!.assignedLeaderId ? { field: 'leaderId', value: currentUser!.assignedLeaderId } : { field: 'createdBy', value: currentUser!.uid })
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
  }, [currentUser?.uid, currentUser?.role, currentUser?.assignedLeaderId, currentUser?.assignedCandidateId, selectedTenantId]);

  // Auth Handlers
  const handleLogin = (user: UserProfile) => {
    setCurrentUser(user);
    setActiveTab(previous => previous === 'login' ? 'dashboard' : previous);

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

  const handleRegisterUser = (newUser: UserProfile) => {
    notifyFirestoreSave(`Cuenta de ${newUser.displayName} creada y guardada en Firestore.`);
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
      throw e;
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
      throw e;
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
      throw e;
    }
  };

  const handleAddCandidate = async (newCandidate: Candidate) => {
    if(demoActive){await saveDemoEntity(currentTenant.tenantId,'candidatos',newCandidate);notifyFirestoreSave('Cambios guardados en su entorno de prueba.');return;}
    requireRealWorkspace();
    try {
      await saveCandidateToFirestore(newCandidate);
      notifyFirestoreSave(`Candidato "${newCandidate.fullName}" guardado exitosamente en Firestore.`);
    } catch (e) {
      console.error('Error saving candidate to Firestore:', e);
      throw e;
    }
  };

  const handleAddProposal = async (newProposal: Proposal) => {
    if(demoActive){await saveDemoEntity(currentTenant.tenantId,'propuestas',newProposal);notifyFirestoreSave('Cambios guardados en su entorno de prueba.');return;}
    requireRealWorkspace();
    try {
      await saveProposalToFirestore(newProposal);
      notifyFirestoreSave(`Proyecto "${newProposal.title}" registrado en Firestore.`);
    } catch (e) {
      console.error('Error saving proposal to Firestore:', e);
      throw e;
    }
  };

  const handleAddExpense = async (newExpense: CampaignExpense) => {
    if(demoActive){await saveDemoEntity(currentTenant.tenantId,'gastos',newExpense);notifyFirestoreSave('Cambios guardados en su entorno de prueba.');return;}
    requireRealWorkspace();
    try {
      await saveExpenseToFirestore(newExpense);
      notifyFirestoreSave(`Gasto de $${newExpense.amount.toLocaleString('es-CO')} COP registrado en Firestore.`);
    } catch (e) {
      console.error('Error saving expense to Firestore:', e);
      throw e;
    }
  };

  const handleUpdateExpense = async (updatedExpense: CampaignExpense) => {
    if(demoActive){await saveDemoEntity(currentTenant.tenantId,'gastos',updatedExpense);notifyFirestoreSave('Cambios guardados en su entorno de prueba.');return;}
    requireRealWorkspace();
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
      throw e;
    }
  };

  const handleDeleteExpense = async (expenseId: string) => {
    if(demoActive){await deleteDemoExpense(currentTenant.tenantId,expenseId);notifyFirestoreSave('Gasto retirado del entorno de prueba.');return;}
    requireRealWorkspace();
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
      throw e;
    }
  };

  const handleAddDonorContribution = async (newContribution: DonorContribution) => {
    if(demoActive){await saveDemoEntity(currentTenant.tenantId,'aportes',newContribution);notifyFirestoreSave('Cambios guardados en su entorno de prueba.');return;}
    requireRealWorkspace();
    try {
      await saveDonorContributionToFirestore(newContribution);
      notifyFirestoreSave(`Aporte de "${newContribution.donorName}" por $${newContribution.amount.toLocaleString('es-CO')} COP registrado en Firestore.`);
    } catch (e) {
      console.error('Error saving donor contribution to Firestore:', e);
      throw e;
    }
  };

  const handleAddLeader = async (newLeader: Leader) => {
    if(demoActive){await saveDemoEntity(currentTenant.tenantId,'lideres',newLeader);notifyFirestoreSave('Cambios guardados en su entorno de prueba.');return;}
    requireRealWorkspace();
    try {
      await saveLeaderToFirestore(newLeader);
      notifyFirestoreSave(`Líder veredal "${newLeader.fullName}" guardado en Firestore.`);
    } catch (e) {
      console.error('Error saving leader to Firestore:', e);
      throw e;
    }
  };

  const handleAddVehicle = async (newVehicle: TransportVehicle) => {
    if(demoActive){await saveDemoEntity(currentTenant.tenantId,'vehiculos',newVehicle);notifyFirestoreSave('Cambios guardados en su entorno de prueba.');return;}
    requireRealWorkspace();
    try {
      await saveVehicleToFirestore(newVehicle);
      notifyFirestoreSave(`Vehículo placa "${newVehicle.licensePlate}" registrado en Firestore.`);
    } catch (e) {
      console.error('Error saving vehicle to Firestore:', e);
      throw e;
    }
  };

  const handleAddGrassrootsVoter = async (newVoter: GrassrootsVoter) => {
    if(demoActive){await saveDemoEntity(currentTenant.tenantId,'votantes_rasos',newVoter);notifyFirestoreSave('Cambios guardados en su entorno de prueba.');return;}
    requireRealWorkspace();
    try {
      await saveGrassrootsVoterToFirestore(newVoter);
      notifyFirestoreSave(`Votante ${newVoter.fullName} registrado(a) y consolidado en la jerarquía electoral.`);
    } catch (e) {
      console.error('Error saving grassroots voter to Firestore:', e);
      throw e;
    }
  };

  const handleUpdateCoordination = async (updatedCoordination: CampaignCoordination) => {
    if(demoActive){await saveDemoEntity(currentTenant.tenantId,'comites_coordinaciones',updatedCoordination);notifyFirestoreSave('Cambios guardados en su entorno de prueba.');return;}
    requireRealWorkspace();
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
      throw e;
    }
  };

  const handleCreateDemo = async () => {
    if(demoAvailable&&!window.confirm('Regenerar reemplazará sus fichas de prueba y los cambios guardados. Los registros reales se conservan. ¿Desea continuar?'))return;
    setDemoBusy(true);
    setDemoError(null);
    try {
      if (!currentUser) throw new Error('Inicie sesión para cargar datos de prueba.');
      const bundle = await createDemoCollection(currentTenant.tenantId, { ...currentUser,
        department: currentUser.department?.trim() || demoDepartment.trim(),
        municipality: currentUser.municipality?.trim() || demoMunicipality.trim() });
      setDemoBundle(bundle);
      setDemoEnabled(true);
    } catch (error) {
      const message = error instanceof Error ? error.message : 'No fue posible crear la colección demo.';
      setDemoError(message);
    } finally {
      setDemoBusy(false);
    }
  };

  const handleDeleteDemo = async () => {
    if(!window.confirm('¿Eliminar su entorno de prueba y sus cambios guardados? Los registros reales se conservan.'))return;
    setDemoBusy(true);
    setDemoError(null);
    try {
      if (!currentUser) return;
      await deleteDemoCollection(currentTenant.tenantId, currentUser.uid);
      setDemoBundle(null);
      setDemoEnabled(false);
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

  const demoAvailable = demoMatchesProfile(demoBundle, currentUser, currentTenant.tenantId);
  const demoActive = demoEnabled && demoAvailable;
  function requireRealWorkspace() {
    if (demoActive) throw new Error('Cambie a datos reales para esta operación. Puede editar las fichas desde el editor de datos de prueba.');
  }
  const demoViewUser = demoActive && currentUser ? { ...currentUser,
    assignedCandidateId: demoBundle!.candidates[0]?.id, assignedLeaderId: demoBundle!.leaders[0]?.id } : currentUser;
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

  if (!currentUser) {
    if (showPublicDemo) {
      return (
        <div className="min-h-screen bg-[#030712] text-slate-100 relative isolate overflow-x-hidden">
          <SynapticNeuralBackground interactive />
          <header className="sticky top-0 z-20 border-b border-slate-800 bg-slate-950/95 px-4 py-3 backdrop-blur">
            <div className="mx-auto flex w-full flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <p className="text-xs font-black uppercase tracking-[0.2em] text-amber-300">Presentación interactiva</p>
                <h1 className="text-lg font-black text-white">Astrea Suite Electoral</h1>
                <p className="text-xs text-slate-400">Todos los nombres, documentos y valores de esta vista son ficticios.</p>
              </div>
              <div className="flex gap-2">
                <button type="button" onClick={() => setShowPublicDemo(false)} className="flex items-center gap-2 rounded-xl border border-slate-700 px-4 py-2 text-xs font-bold text-slate-200 hover:bg-slate-900">
                  <ArrowLeft className="h-4 w-4" /> Inicio
                </button>
                <button type="button" onClick={() => { setShowPublicDemo(false); setActiveTab('login'); }} className="flex items-center gap-2 rounded-xl bg-blue-600 px-4 py-2 text-xs font-black text-white hover:bg-blue-500">
                  <LogIn className="h-4 w-4" /> Iniciar sesión
                </button>
              </div>
            </div>
          </header>
          <main className="mx-auto w-full p-3 sm:p-5 lg:p-6">
            <OperationsProvider tenant={PUBLIC_DEMO_TENANT} user={PUBLIC_DEMO_USER} leaders={PUBLIC_DEMO_DATA.leaders} candidates={PUBLIC_DEMO_DATA.candidates} voters={PUBLIC_DEMO_DATA.voters} expenses={PUBLIC_DEMO_DATA.expenses} vehicles={PUBLIC_DEMO_DATA.vehicles} contributions={PUBLIC_DEMO_DATA.contributions} readOnly demo={PUBLIC_DEMO_DATA.operations}>
            <Suspense fallback={<div className="p-10 text-center text-sm text-slate-400">Cargando presentación…</div>}>
              <DashboardView onNavigateTab={() => { setShowPublicDemo(false); setActiveTab('login'); }} />
            </Suspense>
            </OperationsProvider>
          </main>
        </div>
      );
    }
    if (activeTab !== 'login') {
      return <LandingPage onEnterLogin={() => setActiveTab('login')} onOpenDemo={() => setShowPublicDemo(true)} tenantName={currentTenant.name || 'Astrea'} />;
    }
    return <LoginView users={users} currentUser={null} tenants={tenants} currentTenant={currentTenant} onLogin={handleLogin} onRegister={handleRegisterUser} onLogout={handleLogout} onContinueToApp={() => setActiveTab('dashboard')} onBackToLanding={() => setActiveTab('dashboard')} />;
  }

  return (
    <RouteTrackingProvider user={currentUser} tenantId={currentUser.tenantId} monitorTenantId={currentTenant.tenantId}><div className="min-h-screen bg-[#030712] text-slate-100 flex flex-col font-sans antialiased selection:bg-blue-500 selection:text-white relative isolate overflow-x-hidden">
      <SynapticNeuralBackground interactive={false} />

      {/* Top Navigation Header with Streamlined Toolbar & Profile Pill */}
      <Header
        tenants={tenants}
        currentTenant={currentTenant}
        onSelectTenant={setCurrentTenant}
        onNavigateToTenants={() => setActiveTab('tenants')}
        currentUser={currentUser}
        onOpenAuthModal={() => setShowAuthModal(true)}
        userRole={userRole}
        onSelectRole={() => {}}
      />

      {/* Main Body Layout */}
      <div className="min-w-0 flex-1 flex flex-col md:flex-row">

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
        <main className="app-content min-w-0 flex-1 p-3 sm:p-5 lg:p-6 w-full space-y-5">
          <OperationsProvider key={`${currentTenant.tenantId}-${demoActive?'demo':'real'}`} tenant={currentTenant} user={demoViewUser} leaders={visibleLeaders} candidates={visibleCandidates} voters={visibleVoters} expenses={visibleExpenses} vehicles={visibleVehicles} contributions={visibleContributions} readOnly={demoActive} demo={demoBundle?.operations}>
          <DemoEditing.Provider value={demoActive&&demoBundle?{bundle:demoBundle,realReferences:{candidatos:candidates.map(c=>({id:c.id,name:c.fullName})),lideres:leaders.map(l=>({id:l.id,name:l.fullName})),aportes:donorContributions.map(c=>({id:c.id,name:c.donorName})),vehiculos:vehicles.map(v=>({id:v.id,name:v.licensePlate}))},onPromoted:()=>{setDemoEnabled(false);notifyFirestoreSave('Ficha guardada en datos reales.');}}:null}>
          <OperationsEditingReferences>
          {activeTab === 'device' && isTrackingAdministrator(currentUser) && <><DevicePersistencePanel /><div className="flex flex-wrap gap-3"><EditRecordButton collection="usuarios" record={currentUser} label="Editar mi perfil" />{['AdminTenant','AdminGlobal'].includes(currentUser.role)&&<EditRecordButton collection="organizaciones" record={currentTenant} label="Editar organización" />}</div></>}

          {/* Personalized User Recognition & Salutation Banner */}
          {currentUser && activeTab !== 'login' && activeTab !== 'routes' && activeTab !== 'dashboard' && (
            <UserGreetingBanner
              currentUser={currentUser}
              currentTenant={currentTenant}
              onOpenAuthModal={() => setShowAuthModal(true)}
            />
          )}

          {currentUser && (activeTab === 'dashboard' || demoActive) && activeTab !== 'login' && (
            <details className={`rounded-xl border p-3 ${demoActive ? 'border-amber-400/40 bg-amber-950/30' : 'border-slate-800 bg-slate-900'}`} aria-label="Control de datos de demostración">
              <summary className={`cursor-pointer text-sm font-semibold ${demoActive ? 'text-amber-200' : 'text-slate-300'}`}>{demoActive ? 'Datos de prueba activos · ver opciones' : 'Datos de prueba'}</summary>
              <div className="pt-3">
              <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <p className={`text-sm font-black ${demoActive ? 'text-amber-200' : 'text-blue-200'}`}>
                    {demoActive ? 'Datos de prueba · 100% ficticios' : 'Datos de prueba para su perfil y territorio'}
                  </p>
                  <p className="mt-1 text-xs text-slate-400">
                    {demoActive
                      ? `${demoBundle!.context!.electoralLevel} · ${demoBundle!.context!.department} · ${demoBundle!.context!.municipality}. Puede editar y guardar las fichas. Los cambios se conservan en su entorno de prueba.`
                      : `Perfil: ${currentUser.role}. Cargue su demostración personal para explorar la app. Puede volver a los datos reales en cualquier momento.`}
                  </p>
                  {!currentUser.department?.trim() && <label className="mt-2 block text-xs text-slate-300">Departamento del entorno de prueba<input list="demo-departments" value={demoDepartment} onChange={event => { setDemoDepartment(event.target.value); if (!currentUser.municipality) setDemoMunicipality(''); }} className="ml-2 rounded-lg bg-slate-900 p-2"/><datalist id="demo-departments">{Object.keys(COLOMBIA_ELECTORAL_GEOGRAPHY).map(name => <option key={name} value={name}/>)}</datalist></label>}
                  {!currentUser.municipality?.trim() && <label className="mt-2 block text-xs text-slate-300">Municipio del entorno de prueba<input list="demo-municipalities" value={demoMunicipality} onChange={event => setDemoMunicipality(event.target.value)} className="ml-2 rounded-lg bg-slate-900 p-2"/><datalist id="demo-municipalities">{Object.keys(COLOMBIA_ELECTORAL_GEOGRAPHY[currentUser.department || demoDepartment]?.municipios || {}).map(name => <option key={name} value={name}/>)}</datalist></label>}
                  {demoError && <p className="mt-2 text-xs font-semibold text-rose-300">{demoError}</p>}
                </div>
                <div className="flex shrink-0 flex-wrap gap-2">
                  {(
                    <button type="button" disabled={demoBusy} onClick={handleCreateDemo} className="rounded-xl bg-blue-600 px-4 py-2 text-xs font-black text-white transition hover:bg-blue-500 disabled:cursor-wait disabled:opacity-60">
                      {demoBusy ? 'Cargando…' : demoAvailable ? 'Regenerar mis datos de prueba' : 'Cargar mis datos de prueba'}
                    </button>
                  )}
                  {demoAvailable && <button type="button" disabled={demoBusy} onClick={() => setDemoEnabled(!demoActive)} className="rounded-xl border border-slate-500 px-4 py-2 text-xs font-bold text-slate-200">{demoActive ? 'Usar datos reales' : 'Ver mis datos de prueba'}</button>}
                  {demoBundle && (
                    <button type="button" disabled={demoBusy} onClick={handleDeleteDemo} className="rounded-xl border border-rose-500/40 bg-rose-950/30 px-4 py-2 text-xs font-black text-rose-200 transition hover:bg-rose-900/40 disabled:cursor-wait disabled:opacity-60">
                      {demoBusy ? 'Eliminando…' : 'Eliminar mis datos de prueba'}
                    </button>
                  )}
                </div>
              </div>
              </div>
              {demoActive&&demoBundle&&<DemoDataEditor bundle={demoBundle}/>}
            </details>
          )}

          {/* Real-time Save Toast Notification */}
          {firestoreSyncNotice && (
            <div className="bg-emerald-950/90 border border-emerald-500/50 rounded-2xl px-4 py-3 flex items-center justify-between text-xs text-emerald-200 shadow-xl shadow-emerald-950/40 animate-fade-in">
              <div className="flex items-center gap-2.5">
                <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
                <span className="font-semibold">{firestoreSyncNotice}</span>
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
            <div className="space-y-4">
            <DashboardView onNavigateTab={setActiveTab} />
            <details className="rounded-2xl border border-slate-700 bg-slate-900/80 p-4" onToggle={event=>setShowOperationalDetails(event.currentTarget.open)}><summary className="cursor-pointer text-sm font-semibold text-slate-200">Planillas, control de jornada y detalle administrativo</summary>
            {showOperationalDetails && <div className="mt-4 space-y-4"><OperationsOverview onNavigate={setActiveTab}/><AdministrativeOverview tenantId={currentTenant.tenantId} expenses={visibleExpenses}/></div>}
            </details>
            </div>
          )}

          {currentUser && activeTab === 'resources' && <ResourcesView/>}

          {currentUser && activeTab === 'users' && <UserManagementView currentUser={currentUser} currentTenant={currentTenant} users={users} leaders={leaders} candidates={candidates} />}

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
              currentUser={demoViewUser}
              userRole={userRole}
              grassrootsVoters={visibleVoters}
              leaders={visibleLeaders}
              candidates={visibleCandidates}
              onAddVoter={handleAddGrassrootsVoter}
            />
          )}

          {currentUser && activeTab === 'simulator' && (
            <ElectoralSimulatorView
              key={currentTenant.tenantId}
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
              key={`${currentTenant.tenantId}-${demoActive ? 'demo' : 'real'}`}
              tenantId={currentTenant.tenantId}
              currentUser={currentUser}
              userRole={userRole}
              readOnly={demoActive}
              members={[currentUser,...users]}
              onOpenTracking={(routeId) => { setRouteToOpen(routeId||''); setDemoEnabled(false); setActiveTab('routes'); window.scrollTo({top:0,behavior:'instant'}); }}
              leaders={visibleLeaders.filter((l) => l.tenantId === currentTenant.tenantId)}
              vehicles={visibleVehicles.filter((v) => v.tenantId === currentTenant.tenantId)}
              tenantName={currentTenant.name}
            />
          )}
          {isTrackingAdministrator(currentUser) && activeTab === 'routes' && (demoActive?<p className="rounded-xl border border-amber-700 bg-slate-900 p-4 text-sm text-amber-200">Seleccione «Usar datos reales» para gestionar recorridos y registrar GPS.</p>:<RouteOperationsView key={currentTenant.tenantId} initialRouteId={routeToOpen} user={currentUser} tenantId={currentTenant.tenantId} tenants={tenants} onSelectTenant={setCurrentTenant} users={users} vehicles={vehicles.filter(item=>item.tenantId===currentTenant.tenantId)} />)}

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

          {currentUser && activeTab === 'transport' && (
            <TransportView
              currentTenant={currentTenant}
              currentUser={currentUser}
              userRole={userRole}
              vehicles={visibleVehicles}
              members={[currentUser,...users]}
              readOnly={demoActive}
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

          </OperationsEditingReferences>
          </DemoEditing.Provider>
          </OperationsProvider>
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
        onLogout={handleLogout}
      />


      {/* Footer */}
      <footer className="bg-slate-950 border-t border-slate-900 py-4 px-6 text-center text-xs text-slate-500">
        <p>Astrea Suite Electoral</p>
        <p className="mt-1 text-slate-400">Desarrollada por Wilson José Arias</p>
      </footer>

    </div></RouteTrackingProvider>
  );
}
