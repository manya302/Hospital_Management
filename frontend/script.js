const API_BASE_URL = 'http://localhost:3001/api';
let treatmentsChart = null, trendChart = null;

async function fetchAllData() {
    try {
        const [patients, doctors, appointments, billing] = await Promise.all([
            fetch(`${API_BASE_URL}/patients`).then(r => r.json()),
            fetch(`${API_BASE_URL}/doctors`).then(r => r.json()),
            fetch(`${API_BASE_URL}/appointments`).then(r => r.json()),
            fetch(`${API_BASE_URL}/billing`).then(r => r.json())
        ]);
        return { patients, doctors, appointments, billing };
    } catch(e) { console.error(e); return null; }
}
async function apiGet(path) {
    const r = await fetch(`${API_BASE_URL}${path}`);
    return r.json();
}
async function apiPost(path, body) {
    const r = await fetch(`${API_BASE_URL}${path}`, {
        method:'POST', headers:{'Content-Type':'application/json'}, body:JSON.stringify(body)
    });
    return r.json();
}

// ═══════════════════════════════════════════════════
// PATIENT PORTAL
// LIKE search, COALESCE display
// patient_summary VIEW, NOT EXISTS warning
// Classify_patient_spend() function
// ═══════════════════════════════════════════════════

async function searchPatient() {
    const patientId = document.getElementById('searchPatientId').value.trim();
    if (!patientId) { alert('Please enter Patient ID (e.g., P001)'); return; }
    const data = await fetchAllData();
    if (!data) { alert('Backend not connected'); return; }
    const { patients, doctors, appointments, billing } = data;
    const patient = patients.find(p =>
        p.id?.toString().toLowerCase() === patientId.toLowerCase() ||
        p.patient_id?.toString().toLowerCase() === patientId.toLowerCase()
    );
    if (!patient) { alert(`Patient ${patientId} not found`); return; }

    const today = new Date().toISOString().split('T')[0];
    const patAppts = appointments.filter(a => a.patient_id?.toString().toLowerCase() === patientId.toLowerCase());
    const todayApps    = patAppts.filter(a => new Date(a.date_time).toISOString().split('T')[0] === today);
    const upcomingApps = patAppts.filter(a => new Date(a.date_time).toISOString().split('T')[0] > today)
                                  .sort((a,b) => new Date(a.date_time)-new Date(b.date_time));
    const pastApps     = patAppts.filter(a => new Date(a.date_time).toISOString().split('T')[0] < today)
                                  .sort((a,b) => new Date(b.date_time)-new Date(a.date_time));
    const patBills = billing.filter(b => b.patient_id?.toString().toLowerCase() === patientId.toLowerCase());

    document.getElementById('patientResults').style.display = 'block';

    // Sstored function call
    let spendInfo = { total_billed: 0, spend_class: 'None' };
    try { spendInfo = await apiGet(`/analytics/fn/patient-spend/${patientId}`); } catch(e) {}

    // patient_summary VIEW
    let viewData = null;
    try { viewData = await apiGet(`/analytics/view/patient-summary/${patientId}`); } catch(e) {}

    document.getElementById('patientInfo').innerHTML = `
        <div style="display:grid;grid-template-columns:1fr 1fr;gap:0.5rem">
            <p><strong>ID:</strong> ${patient.id}</p>
            <p><strong>Name:</strong> ${patient.name}</p>
            <p><strong>Email:</strong> ${patient.email}</p>
            <p><strong>Phone:</strong> ${patient.phone || 'N/A'}</p>
            <p><strong>DOB:</strong> ${patient.dob ? new Date(patient.dob).toLocaleDateString() : 'N/A'}</p>
            <p><strong>Gender:</strong> ${patient.gender || 'N/A'}</p>
            <p><strong>Address:</strong> ${patient.address || 'Not provided'}</p>
            <p><strong>Insurance:</strong> ${patient.insurance_provider || 'Not Insured'}</p>
        </div>
        <div style="margin-top:1rem;padding:0.8rem;background:#f0f7ff;border-radius:16px;display:flex;gap:2rem;flex-wrap:wrap;align-items:center">
            ${viewData ? `<div>
                <div style="font-size:0.75rem;color:#4a627a">Outstanding Bill<small>(from VIEW)</small></div>
                <div style="font-size:1.1rem;font-weight:600;color:#c73e1a">$${Number(viewData.outstanding||0).toFixed(2)}</div>
            </div>` : ''}
        </div>
        ${patAppts.length === 0 ? `
        <div style="margin-top:0.8rem;padding:0.6rem 1rem;background:#fff3e0;border-radius:12px;color:#c67c00;font-size:0.9rem">
            ⚠️ No appointment history — shown via <code>NOT EXISTS</code> check in Patient Portal
        </div>` : ''}
    `;
    document.getElementById('todayAppointments').innerHTML    = renderAppointmentTable(todayApps, doctors);
    document.getElementById('upcomingAppointments').innerHTML = renderAppointmentTable(upcomingApps, doctors);
    document.getElementById('pastAppointments').innerHTML = renderAppointmentTable(pastApps, doctors, false, false);
    document.getElementById('patientBillingInfo').innerHTML   = renderBillingTable(patBills);
}

// name search using LIKE + string functions (separate search box)
async function searchPatientByName() {
    const q = document.getElementById('searchPatientName')?.value?.trim();
    if (!q) return;
    let results = [];
    try { results = await apiGet(`/analytics/patients/search?q=${encodeURIComponent(q)}`); } catch(e) { return; }
    const el = document.getElementById('patientNameResults');
    if (!el) return;
    if (!results.length) { el.innerHTML='<p style="color:#4a627a">No patients found.</p>'; return; }
    el.innerHTML = `
        <p style="font-size:0.8rem;color:#4a627a;margin-bottom:0.5rem">
            Results using <code>LIKE</code> — showing <code>UPPER</code>, <code>LENGTH</code>, <code>SUBSTR</code>, <code>COALESCE</code>, <code>TO_CHAR</code>
        </p>
        <table class="data-table"><thead><tr>
            <th>ID</th><th>Name (UPPER)</th><th>Short (SUBSTR)</th><th>Length</th><th>DOB (TO_CHAR)</th><th>Insurance (COALESCE)</th>
        </tr></thead><tbody>
        ${results.map(r=>`<tr>
            <td>${r.patient_id}</td><td>${r.name_upper}</td><td>${r.short_name}</td>
            <td>${r.name_length}</td><td>${r.dob_formatted}</td><td>${r.insurance_display}</td>
        </tr>`).join('')}
        </tbody></table>`;
}

// Add New Patient
async function registerPatient(e) {
    e.preventDefault();
    const statusEl = document.getElementById('addPatientStatus');
    const first_name = document.getElementById('newFirstName').value.trim();
    const last_name  = document.getElementById('newLastName').value.trim();
    const email      = document.getElementById('newEmail').value.trim();
    const contact_number  = document.getElementById('newPhone').value.trim() || null;
    const date_of_birth   = document.getElementById('newDob').value || null;
    const gender          = document.getElementById('newGender').value || null;
    const address         = document.getElementById('newAddress').value.trim() || null;
    const insurance_provider = document.getElementById('newInsuranceProvider').value.trim() || null;
    const insurance_number   = document.getElementById('newInsuranceNumber').value.trim() || null;

    if (!first_name || !last_name || !email) {
        statusEl.innerHTML = `<span style="color:#c73e1a">❌ First name, last name and email are required.</span>`;
        return;
    }
    statusEl.innerHTML = `<span style="color:#1e88e5">🔄 Registering patient…</span>`;
    try {
        const result = await apiPost('/patients', {
            first_name, last_name, email, contact_number,
            date_of_birth, gender, address, insurance_provider, insurance_number
        });
        if (result.id || result.patient_id) {
            const newId = result.id || result.patient_id;
            statusEl.innerHTML = `<span style="color:#388e3c">✅ Patient registered successfully! ID: <strong>${newId}</strong></span>`;
            document.getElementById('addPatientForm').reset();
        } else {
            statusEl.innerHTML = `<span style="color:#c73e1a">❌ ${result.error || 'Registration failed'}</span>`;
        }
    } catch (err) {
        statusEl.innerHTML = `<span style="color:#c73e1a">❌ Error: ${err.message}</span>`;
    }
}


// parameterized cursor schedule
// get_doctor_appt_count()
// EXISTS-based availability badge
// ═══════════════════════════════════════════════════

async function searchDoctor() {
    const doctorId = document.getElementById('searchDoctorId').value.trim();
    if (!doctorId) { alert('Please enter Doctor ID (e.g., D001)'); return; }
    const data = await fetchAllData();
    if (!data) { alert('Backend not connected'); return; }
    const { patients, doctors, appointments } = data;
    const doctor = doctors.find(d =>
        d.id?.toString().toLowerCase() === doctorId.toLowerCase() ||
        d.doctor_id?.toString().toLowerCase() === doctorId.toLowerCase()
    );
    if (!doctor) { alert(`Doctor ${doctorId} not found`); return; }
    const docAppts = appointments.filter(a => a.doctor_id?.toString().toLowerCase() === doctorId.toLowerCase());
    const today = new Date().toISOString().split('T')[0];
    const upcomingApps = docAppts.filter(a => new Date(a.date_time).toISOString().split('T')[0] >= today)
                                  .sort((a,b) => new Date(a.date_time)-new Date(b.date_time));
    const treatmentCounts = {};
    docAppts.forEach(app => {
        const name = app.reason || 'General Checkup';
        treatmentCounts[name] = (treatmentCounts[name]||0) + 1;
    });

    document.getElementById('doctorResults').style.display = 'block';

    let fnCount = { count: docAppts.length };
    try { fnCount = await apiGet(`/analytics/fn/doctor-appt-count/${doctorId}`); } catch(e) {}
    let cursorSchedule = [];
    try { cursorSchedule = await apiGet(`/analytics/cursor/doctor-schedule/${doctorId}`); } catch(e) {}

    const hasUpcoming = upcomingApps.length > 0;
    document.getElementById('doctorInfo').innerHTML = `
        <div style="display:grid;grid-template-columns:1fr 1fr;gap:0.5rem">
            <p><strong>ID:</strong> ${doctor.id}</p>
            <p><strong>Name:</strong> Dr. ${doctor.name}</p>
            <p><strong>Specialty:</strong> ${doctor.specialty}</p>
            <p><strong>Email:</strong> ${doctor.email}</p>
            <p><strong>Phone:</strong> ${doctor.phone}</p>
            <p><strong>Experience:</strong> ${doctor.years_experience||'N/A'} years</p>
        </div>
        <div style="margin-top:1rem;padding:0.8rem;background:#f0f7ff;border-radius:16px;display:flex;gap:2rem;flex-wrap:wrap;align-items:center">
            <div>
                <div style="font-size:0.75rem;color:#4a627a">Upcoming</div>
                <div style="font-size:1.5rem;font-weight:700;color:#388e3c">${upcomingApps.length}</div>
            </div>
            <div>
                <div style="font-size:0.75rem;color:#4a627a">Availability <small>(EXISTS check)</small></div>
                <span style="background:${hasUpcoming?'#e3f2fd':'#e0f7ed'};color:${hasUpcoming?'#0b5e9e':'#1e6f4c'};padding:0.2rem 0.9rem;border-radius:40px;font-weight:600;font-size:0.8rem;display:inline-block">
                    ${hasUpcoming?'Has Upcoming':'Available'}
                </span>
            </div>
        </div>
        ${cursorSchedule.length ? `
        <div style="margin-top:1rem">
            <p style="font-weight:600;color:#0f2b3d;margin-bottom:0.4rem">📋 Schedule via Parameterized Cursor</p>
            <table class="data-table"><thead><tr><th>Appt ID</th><th>Patient</th><th>Date</th><th>Time</th><th>Status</th></tr></thead><tbody>
            ${[...cursorSchedule].sort((a,b) => new Date(b.appt_date) - new Date(a.appt_date)).map(r=>`<tr>
                <td>${r.appointment_id}</td><td>${r.patient_name}</td>
                <td>${r.appt_date?new Date(r.appt_date).toLocaleDateString():'N/A'}</td>
                <td>${r.appt_time||'N/A'}</td>
                <td><span class="badge badge-${(r.status||'pending').toLowerCase()}">${r.status}</span></td>
            </tr>`).join('')}
            </tbody></table>
            ${cursorSchedule.length>5?`<p style="color:#4a627a;font-size:0.8rem;margin-top:0.3rem">…and ${cursorSchedule.length-5} more</p>`:''}
        </div>` : ''}
    `;
    document.getElementById('doctorUpcomingAppointments').innerHTML = renderAppointmentTable(upcomingApps, doctors, true, patients);

    if (treatmentsChart) treatmentsChart.destroy();
    treatmentsChart = new Chart(document.getElementById('treatmentsChart').getContext('2d'), {
        type:'bar',
        data:{ labels:Object.keys(treatmentCounts),
               datasets:[{ label:'Treatments', data:Object.values(treatmentCounts),
                           backgroundColor:'rgba(54,162,235,0.5)', borderColor:'rgba(54,162,235,1)', borderWidth:1 }] },
        options:{ responsive:true, scales:{ y:{ beginAtZero:true } } }
    });
}

// ═══════════════════════════════════════════════════
// APPOINTMENTS PAGE
// ORDER BY toggle, transactional booking
// Trigger rejects past dates (error shown)
// ═══════════════════════════════════════════════════

let currentSort = { by:'date', order:'desc' };

async function renderAllAppointments() {
    let appointments = [];
    try {
        appointments = await apiGet(`/analytics/appointments/sorted?sort_by=${currentSort.by}&order=${currentSort.order}`);
    } catch(e) {
        const data = await fetchAllData();
        if (data) appointments = data.appointments;
    }
    document.getElementById('allAppointmentsTable').innerHTML = renderSortableTable(appointments);
}

function renderSortableTable(appointments) {
    if (!appointments?.length) return '<p>No appointments found</p>';
    const icon = col => currentSort.by===col ? (currentSort.order==='asc'?'↑':'↓') : '↕';
    const th   = (col,label) => `<th style="cursor:pointer" onclick="sortAppointments('${col}')">${label} ${icon(col)}</th>`;
    let html = `<p style="font-size:0.8rem;color:#4a627a;margin-bottom:0.5rem">Click headers to sort — uses <code>ORDER BY</code></p>
        <table class="data-table"><thead><tr>
        ${th('date','Date & Time')}${th('doctor','Doctor')}<th>Patient</th><th>Reason</th>${th('status','Status')}
        </tr></thead><tbody>`;
    appointments.forEach(app => {
        let dtStr = 'N/A';

        if (app.date_time) {
            dtStr = formatDateTime(app.date_time);
        } 
        else if (app.appointment_date && app.appointment_time) {
            // extract ONLY date part if it accidentally contains full timestamp
            const dateOnly = app.appointment_date.split('T')[0];

            const time = app.appointment_time.length === 5
                ? app.appointment_time + ':00'
                : app.appointment_time;

            dtStr = formatDateTime(`${dateOnly}T${time}`);
        }
        html += `<tr>
            <td>${dtStr}</td>
            <td>Dr. ${app.doctor_name||'Unknown'}</td>
            <td>${app.patient_name||app.patient_id||'N/A'}</td>
            <td>${app.reason_for_visit||app.reason||'N/A'}</td>
            <td><span class="badge badge-${(app.status||'pending').toLowerCase()}">${app.status||'Pending'}</span></td>
        </tr>`;
    });
    return html + '</tbody></table>';
}

function sortAppointments(col) {
    if (currentSort.by===col) currentSort.order = currentSort.order==='asc'?'desc':'asc';
    else { currentSort.by=col; currentSort.order='asc'; }
    renderAllAppointments();
}

async function searchAppointment() {
    const query = document.getElementById('searchAppointmentQuery').value.trim();
    if (!query) { alert('Please enter Appointment ID or Patient ID'); return; }
    const data = await fetchAllData();
    if (!data) { alert('Backend not connected'); return; }
    const { appointments, doctors, patients } = data;
    let results = [];
    // Check if it looks like an appointment ID (e.g. A007, a007, or a plain number)
    const isAppointmentId = /^a\d+$/i.test(query) || !isNaN(query);

    if (isAppointmentId) {
        results = appointments.filter(a =>
            a.id?.toString().toLowerCase() === query.toLowerCase() ||
            a.appointment_id?.toString().toLowerCase() === query.toLowerCase()
        );
    } else {
        // Treat as patient ID or name
        const patient = patients.find(p =>
            p.id?.toString().toLowerCase() === query.toLowerCase() ||
            p.patient_id?.toString().toLowerCase() === query.toLowerCase()
        );
        if (patient) results = appointments.filter(a =>
            a.patient_id?.toString().toLowerCase() === query.toLowerCase() || a.patient_id == patient.id
        );
    }
    document.getElementById('appointmentSearchResults').innerHTML = results.length
        ? `<h4>📋 ${results.length} result(s) for "${query}"</h4>${renderDetailedAppointmentTable(results, doctors, patients)}`
        : `<div style="padding:1rem;background:#fff3e0;border-radius:12px;color:#c67c00">❌ No appointments found for <strong>${query}</strong></div>`;
}

async function bookAppointment(e) {
    e.preventDefault();
    const appointmentData = {
        patient_id: document.getElementById('appPatientId').value,
        doctor_id:  document.getElementById('appDoctorId').value,
        appointment_date: document.getElementById('appDate').value,
        appointment_time: document.getElementById('appTime').value,
        reason_for_visit: document.getElementById('appReason').value
    };
    const statusEl = document.getElementById('bookingStatus');
    if (statusEl) statusEl.innerHTML = `<span style="color:#1e88e5">🔄 Booking with transaction (BEGIN/SAVEPOINT/COMMIT)…</span>`;
    try {
        // Transaction + Trigger validation
        const result = await apiPost('/analytics/appointments/book-safe', appointmentData);
        if (result.success) {
            if (statusEl) statusEl.innerHTML = `<span style="color:#388e3c">✅ ${result.message}</span>`;
            alert(`✅ Booked! ID: ${result.appointment_id}`);
            document.getElementById('newAppointmentForm').reset();
            renderAllAppointments();
        } else {
            //trigger may have blocked this (e.g. past date)
            if (statusEl) statusEl.innerHTML = `<span style="color:#c73e1a">❌ ${result.error}</span>`;
            alert(`❌ Booking failed (trigger or validation):\n${result.error}`);
        }
    } catch(error) {
        // Fallback to legacy route
        try {
            const response = await fetch(`${API_BASE_URL}/appointments`, {
                method:'POST', headers:{'Content-Type':'application/json'},
                body: JSON.stringify({
                    patient_id: parseInt(appointmentData.patient_id),
                    doctor_id:  parseInt(appointmentData.doctor_id),
                    appointment_date: appointmentData.appointment_date,
                    appointment_time: appointmentData.appointment_time,
                    reason_for_visit: appointmentData.reason_for_visit,
                    status:'Scheduled'
                })
            });
            if (response.ok) {
                alert('Appointment booked successfully!');
                document.getElementById('newAppointmentForm').reset();
                renderAllAppointments();
            } else alert('Error booking appointment');
        } catch(err) { alert('Error booking appointment'); }
    }
}

// ═══════════════════════════════════════════════════
// ADMIN PANEL
// SET ops, EXISTS, VIEWs
// GROUP BY, HAVING, WITH, aggregates
// cursor unpaid patients
// stored procedure buttons
// ═══════════════════════════════════════════════════

async function renderAdminPanel() {
    const [data, dashStats, doctorLoad, busySpec,
           missingBilling, neverAppointed, availDoctors,
           unpaidPatients] = await Promise.all([
        fetchAllData(),
        apiGet('/analytics/stats/dashboard').catch(()=>null),
        apiGet('/analytics/stats/doctor-load').catch(()=>[]),
        apiGet('/analytics/stats/busy-specialties?min_appointments=1').catch(()=>[]),
        apiGet('/analytics/admin/patients-missing-billing').catch(()=>[]),
        apiGet('/analytics/admin/patients-never-appointed').catch(()=>[]),
        apiGet('/analytics/admin/doctors-available').catch(()=>[]),
        apiGet('/analytics/cursor/unpaid-patients').catch(()=>[]),
    ]);
    if (!data) return;

    // ── Stats cards (SUM, COUNT, AVG, MAX, MIN) ──
    if (dashStats) {
        document.getElementById('adminStatsCards').innerHTML = `
            <div class="stats-row">
                <div class="stat-card"><div style="font-size:0.75rem;color:#4a627a">Patients</div>
                    <div style="font-size:2rem;font-weight:700;color:#1e88e5">${dashStats.patients.total}</div></div>
                <div class="stat-card"><div style="font-size:0.75rem;color:#4a627a">Doctors</div>
                    <div style="font-size:2rem;font-weight:700;color:#0b6e4f">${dashStats.doctors.total}</div></div>
                <div class="stat-card"><div style="font-size:0.75rem;color:#4a627a">Today's Appts</div>
                    <div style="font-size:2rem;font-weight:700;color:#c67c00">${dashStats.appointments.today}</div></div>
                <div class="stat-card"><div style="font-size:0.75rem;color:#4a627a">Revenue <small>(SUM)</small></div>
                    <div style="font-size:1.6rem;font-weight:700;color:#388e3c">$${Number(dashStats.billing.total_revenue).toFixed(0)}</div></div>
                <div class="stat-card"><div style="font-size:0.75rem;color:#4a627a">Outstanding</div>
                    <div style="font-size:1.6rem;font-weight:700;color:#c73e1a">$${Number(dashStats.billing.outstanding).toFixed(0)}</div></div>
                <div class="stat-card"><div style="font-size:0.75rem;color:#4a627a">Avg Bill <small>(AVG)</small></div>
                    <div style="font-size:1.6rem;font-weight:700;color:#7b1fa2">$${Number(dashStats.billing.avg_bill||0).toFixed(0)}</div></div>
            </div>`;
    }

    // ── Trend chart (GROUP BY date) ──
    const { appointments } = data;
    const uniqueDates = [...new Set(appointments.map(a => {
        const d = new Date(a.date_time); return !isNaN(d)?d.toISOString().split('T')[0]:null;
    }).filter(Boolean))].sort();
    const last7 = uniqueDates.slice(-7);
    const counts = last7.map(date => appointments.filter(a => {
        const d = new Date(a.date_time); return !isNaN(d)&&d.toISOString().split('T')[0]===date;
    }).length);
    if (trendChart) trendChart.destroy();
    trendChart = new Chart(document.getElementById('trendChart').getContext('2d'), {
        type:'line',
        data:{ labels:last7, datasets:[{ label:'Appointments', data:counts,
            borderColor:'rgb(75,192,192)', backgroundColor:'rgba(75,192,192,0.2)', tension:0.1, fill:true }] },
        options:{ responsive:true, plugins:{ title:{ display:true, text:'Appointment Trends (GROUP BY date)' } },
                  scales:{ y:{ beginAtZero:true } } }
    });

    // ── Doctor Load table (GROUP BY + COUNT/CASE) ──
    let docHtml = `<p style="font-size:0.8rem;color:#4a627a;margin-bottom:0.5rem">
        Uses <code>GROUP BY</code> with <code>COUNT</code>, <code>HAVING</code>, and <code>doctor_workload</code> VIEW</p>
        <table class="data-table"><thead><tr>
        <th>Doctor ID</th><th>Doctor</th><th>Specialty</th><th>Exp</th><th>Total</th><th>Completed</th><th>Scheduled</th><th>Cancelled</th>
        </tr></thead><tbody>`;
    (doctorLoad.length ? doctorLoad : data.doctors).forEach(doc => {
        docHtml += `<tr>
            <td><code>${doc.doctor_id||doc.id||'N/A'}</code></td>
            <td><strong>Dr. ${doc.doctor_name||doc.name}</strong></td>
            <td>${doc.specialization||doc.specialty}</td>
            <td>${doc.years_experience||'N/A'}y</td>
            <td><strong>${doc.total||0}</strong></td>
            <td><span class="badge badge-completed">${doc.completed||0}</span></td>
            <td><span class="badge badge-confirmed">${doc.scheduled||0}</span></td>
            <td><span class="badge badge-cancelled">${doc.cancelled||0}</span></td>
        </tr>`;
    });
    document.getElementById('adminDoctorList').innerHTML = docHtml + '</tbody></table>';

    // ── HAVING: busy specialties ──
    const specEl = document.getElementById('adminBusySpecialties');
    if (specEl) specEl.innerHTML = busySpec.length ? `
        <p style="font-size:0.8rem;color:#4a627a;margin-bottom:0.5rem"><code>GROUP BY specialization HAVING COUNT(appointments) > 1</code></p>
        <table class="data-table"><thead><tr><th>Specialty</th><th>Doctors</th><th>Total Appts</th><th>Avg Load</th></tr></thead><tbody>
        ${busySpec.map(s=>`<tr><td><strong>${s.specialty||s.specialization}</strong></td><td>${s.num_doctors}</td>
            <td>${s.total_appointments}</td><td>${s.load_per_doctor}</td></tr>`).join('')}
        </tbody></table>` : '<p style="color:#4a627a">No specialties with sufficient data yet.</p>';

    // ── EXCEPT: missing billing ──
    const missingEl = document.getElementById('adminMissingBilling');
    if (missingEl) missingEl.innerHTML = missingBilling.length ? `
        <p style="font-size:0.8rem;color:#4a627a;margin-bottom:0.5rem"><code>SELECT FROM appointments EXCEPT SELECT FROM billing</code></p>
        <table class="data-table"><thead><tr><th>Patient</th><th>Email</th><th>Appointments</th></tr></thead><tbody>
        ${missingBilling.map(p=>`<tr><td>${p.full_name}</td><td>${p.email}</td><td>${p.appointment_count}</td></tr>`).join('')}
        </tbody></table>` : '<p style="color:#388e3c">✅ All patients with appointments have billing records.</p>';

    // ── NOT EXISTS: never appointed ──
    const neverEl = document.getElementById('adminNeverAppointed');
    if (neverEl) neverEl.innerHTML = neverAppointed.length ? `
        <p style="font-size:0.8rem;color:#4a627a;margin-bottom:0.5rem"><code>WHERE NOT EXISTS (SELECT 1 FROM appointments ...)</code></p>
        <table class="data-table"><thead><tr><th>Patient</th><th>Email</th><th>Registered</th></tr></thead><tbody>
        ${neverAppointed.map(p=>`<tr><td>${p.full_name}</td><td>${p.email}</td><td>${p.registered_on}</td></tr>`).join('')}
        </tbody></table>` : '<p style="color:#388e3c">✅ All registered patients have at least one appointment.</p>';

    // ── NOT EXISTS: available doctors ──
    const availEl = document.getElementById('adminAvailableDoctors');
    if (availEl) availEl.innerHTML = availDoctors.length ? `
        <p style="font-size:0.8rem;color:#4a627a;margin-bottom:0.5rem"><code>WHERE NOT EXISTS (upcoming appointments)</code></p>
        <table class="data-table"><thead><tr><th>Doctor</th><th>Specialty</th><th>Experience</th><th>Branch</th></tr></thead><tbody>
        ${availDoctors.map(d=>`<tr><td>Dr. ${d.doctor_name}</td><td>${d.specialization}</td><td>${d.years_experience}y</td><td>${d.hospital_branch}</td></tr>`).join('')}
        </tbody></table>` : '<p style="color:#4a627a">All doctors have upcoming appointments scheduled.</p>';

    // ── Cursor: unpaid patients ──
    const unpaidEl = document.getElementById('adminUnpaidPatients');
    if (unpaidEl) unpaidEl.innerHTML = unpaidPatients.length ? `
        <p style="font-size:0.8rem;color:#4a627a;margin-bottom:0.5rem">Via <strong>PL/pgSQL explicit cursor</strong> — <code>get_unpaid_patients()</code></p>
        <table class="data-table"><thead><tr><th>Patient ID</th><th>Name</th><th>Bills</th><th>Outstanding</th></tr></thead><tbody>
        ${unpaidPatients.map(p=>`<tr>
            <td>${p.patient_id}</td><td>${p.full_name}</td><td>${p.bill_count}</td>
            <td style="color:#c73e1a;font-weight:600">$${Number(p.outstanding_amount).toFixed(2)}</td>
        </tr>`).join('')}
        </tbody></table>` : '<p style="color:#388e3c">✅ No outstanding bills.</p>';
}

// ─── HELPERS ─────────────────────────────────────────────────

function formatDateTime(dt) {
    if (!dt) return 'N/A';

    let date;

    // Case 1: already ISO with Z (from /appointments)
    if (typeof dt === 'string' && dt.includes('Z')) {
        date = new Date(dt);
    }
    // Case 2: manually constructed string (THIS IS YOUR CASE)
    else {
        // Force UTC interpretation (CRITICAL FIX)
        date = new Date(dt + 'Z');
    }

    if (isNaN(date)) {
        console.log("INVALID:", dt);
        return 'N/A';
    }

    const time = date.toLocaleTimeString([], {
        hour: 'numeric',
        minute: '2-digit',
        hour12: true
    });

    const formattedDate = date.toLocaleDateString('en-GB');

    return `${time}  ${formattedDate}`;
}

function renderDetailedAppointmentTable(appointments, doctors, patients) {
    if (!appointments?.length) return '<p>No appointments found</p>';
    let html = `<table class="data-table"><thead><tr>
        <th>Appt ID</th><th>Patient</th><th>Doctor</th><th>Date & Time</th><th>Reason</th><th>Status</th>
    </tr></thead><tbody>`;
    appointments.forEach(app => {
        const patient = patients.find(p => p.id==app.patient_id||p.patient_id==app.patient_id);
        const doctor  = doctors.find(d => d.id==app.doctor_id||d.doctor_id==app.doctor_id);
        const dt = new Date(app.date_time);
        html += `<tr>
            <td><strong>${app.id||app.appointment_id||'N/A'}</strong></td>
            <td>${patient?patient.name:'Unknown'}</td>
            <td>Dr. ${doctor?doctor.name:'Unknown'}</td>
            <td>${!isNaN(dt)?dt.toLocaleString():app.date_time||'N/A'}</td>
            <td>${app.reason||app.reason_for_visit||'N/A'}</td>
            <td><span class="badge badge-${(app.status||'pending').toLowerCase()}">${app.status||'Pending'}</span></td>
        </tr>`;
    });
    return html + '</tbody></table>';
}

function renderAppointmentTable(appointments, doctors, showPatient=true, patients=null) {
    if (!appointments?.length) return '<p>No appointments found</p>';
    let html = `<table class="data-table"><thead><tr>
        <th>ID</th><th>Date & Time</th><th>Doctor</th>
        ${showPatient?'<th>Patient</th>':''}<th>Reason</th><th>Status</th>
    </tr></thead><tbody>`;
    appointments.forEach(app => {
        const doctor = doctors.find(d => d.id==app.doctor_id||d.doctor_id==app.doctor_id);
        let patName = '';
        if (showPatient && patients) {
            const p = patients.find(p => p.id==app.patient_id||p.patient_id==app.patient_id);
            patName = p?p.name:'Unknown';
        }
        const dt = new Date(app.date_time);
        html += `<tr>
            <td>${app.id||app.appointment_id||'N/A'}</td>
            <td>${!isNaN(dt)?dt.toLocaleString():app.date_time||'N/A'}</td>
            <td>Dr. ${doctor?doctor.name:'Unknown'}</td>
            ${showPatient?`<td>${patName}</td>`:''}
            <td>${app.reason||app.reason_for_visit||'N/A'}</td>
            <td><span class="badge badge-${(app.status||'pending').toLowerCase()}">${app.status||'Pending'}</span></td>
        </tr>`;
    });
    return html + '</tbody></table>';
}

function renderBillingTable(bills) {
    if (!bills?.length) return '<p>No billing records found</p>';
    let html = `<table class="data-table"><thead><tr>
        <th>Bill ID</th><th>Amount</th><th>Status</th><th>Date</th><th>Payment Method</th>
    </tr></thead><tbody>`;
    bills.forEach(bill => {
        const badgeClass = bill.payment_status==='Paid'?'badge-paid':bill.payment_status==='Overdue'?'badge-overdue':'badge-unpaid';
        html += `<tr>
            <td>#${bill.id}</td><td>$${bill.amount}</td>
            <td><span class="badge ${badgeClass}">${bill.payment_status||'Pending'}</span></td>
            <td>${new Date(bill.due_date).toLocaleDateString()}</td>
            <td>${bill.payment_method||'Not Specified'}</td>
        </tr>`;
    });
    return html + '</tbody></table>';
}

// ─── TREATMENTS SUMMARY (Home Page) ──────────────────────────

let treatmentModalChart = null;

async function openTreatmentModal() {
    const modal = document.getElementById('treatmentModal');
    if (!modal) return;
    modal.style.display = 'flex';
    document.getElementById('modalTreatmentStats').innerHTML = '<span style="color:#1e88e5">⏳ Loading…</span>';

    let data;
    try {
        data = await apiGet('/analytics/stats/treatments-summary');
    } catch(e) {
        document.getElementById('modalTreatmentStats').innerHTML =
            '<span style="color:#c73e1a">❌ Could not load treatment data. Make sure the backend is running.</span>';
        return;
    }

    const { breakdown = [], totals = {} } = data;

    // ── Stat cards ──
    const statCards = [
        { label: 'Total Treatments', value: totals.total_treatments || 0, color: '#1e88e5' },
        { label: 'Avg Cost / Treatment', value: `$${Number(totals.avg_cost || 0).toFixed(2)}`, color: '#c67c00' },
    ];
    document.getElementById('modalTreatmentStats').innerHTML = statCards.map(s => `
        <div style="flex:1;min-width:130px;background:#f0f7ff;border-radius:16px;padding:0.8rem 1rem;border:1px solid #e0edf5">
            <div style="font-size:0.72rem;color:#4a627a">${s.label}</div>
            <div style="font-size:1.4rem;font-weight:700;color:${s.color}">${s.value}</div>
        </div>`).join('');

    if (!breakdown.length) {
        document.getElementById('treatmentModalChart').parentElement.innerHTML =
            '<p style="color:#4a627a;text-align:center;padding:2rem">No treatment records found in the database yet.</p>';
        document.getElementById('treatmentModalTable').innerHTML = '';
        return;
    }

    // ── Chart ──
    const palette = ['#1e88e5','#0b6e4f','#7b1fa2','#c67c00','#e53935','#00897b','#f57c00','#5c6bc0','#8d6e63','#546e7a'];
    const labels = breakdown.map(r => r.treatment_type);
    const counts = breakdown.map(r => Number(r.total_treatments));
    const revenues = breakdown.map(r => Number(r.total_cost));

    if (treatmentModalChart) treatmentModalChart.destroy();
    treatmentModalChart = new Chart(
        document.getElementById('treatmentModalChart').getContext('2d'), {
        type: 'bar',
        data: {
            labels,
            datasets: [
                {
                    label: 'No. of Treatments',
                    data: counts,
                    backgroundColor: palette.map(c => c + 'cc'),
                    borderColor: palette,
                    borderWidth: 1,
                    yAxisID: 'y',
                },
            ]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                legend: { position: 'top' },
                title: { display: true, text: 'Treatments by Type (count + revenue)' }
            },
            scales: {
                y:  { beginAtZero: true, title: { display: true, text: 'Count' } },
                y1: { beginAtZero: true, position: 'right', title: { display: true, text: 'Revenue ($)' },
                      grid: { drawOnChartArea: false } }
            }
        }
    });

    // ── Table ──
    document.getElementById('treatmentModalTable').innerHTML = `
        <thead><tr>
            <th>Treatment Type</th><th>Count</th><th>Avg Cost</th>
        </tr></thead><tbody>
        ${breakdown.map((r, i) => `<tr>
            <td><span style="display:inline-block;width:10px;height:10px;border-radius:50%;background:${palette[i % palette.length]};margin-right:6px"></span>
                <strong>${r.treatment_type}</strong></td>
            <td>${r.total_treatments}</td>
            <td>$${Number(r.avg_cost).toFixed(2)}</td>
        </tr>`).join('')}
        </tbody>`;

    // ── Also populate the home page bar ──
    populateHomeTreatmentBar(breakdown, totals);
}

function closeTreatmentModal() {
    const modal = document.getElementById('treatmentModal');
    if (modal) modal.style.display = 'none';
}

function populateHomeTreatmentBar(breakdown, totals) {
    const bar = document.getElementById('homeTreatmentBar');
    const statsEl = document.getElementById('homeTreatmentStats');
    if (!bar || !statsEl) return;
    bar.style.display = 'block';
    const top3 = breakdown.slice(0, 3);
    statsEl.innerHTML = [
        { label: 'Treatments Performed', value: totals.total_treatments || 0, color: '#1e88e5' },
        ...top3.map(t => ({ label: t.treatment_type, value: `${t.total_treatments} cases`, color: '#0b6e4f' }))
    ].map(s => `
        <div style="flex:1;min-width:120px;background:#f9fcff;border-radius:14px;padding:0.7rem 1rem;border:1px solid #e0edf5">
            <div style="font-size:0.7rem;color:#4a627a">${s.label}</div>
            <div style="font-size:1.1rem;font-weight:700;color:${s.color}">${s.value}</div>
        </div>`).join('');
}



function navigateTo(pageId) {
    document.querySelectorAll('.page').forEach(p => p.classList.remove('active-page'));
    document.getElementById(`${pageId}-page`).classList.add('active-page');
    document.querySelectorAll('.nav-links button').forEach(btn =>
        btn.classList.toggle('active', btn.getAttribute('data-page')===pageId));
    if (pageId==='appointments') renderAllAppointments();
    if (pageId==='admin') renderAdminPanel();
}

async function init() {
    document.querySelectorAll('.nav-links button').forEach(btn =>
        btn.addEventListener('click', () => navigateTo(btn.getAttribute('data-page'))));
    document.getElementById('quickBookBtn')?.addEventListener('click', () => navigateTo('appointments'));
    document.getElementById('quickAddPatientBtn')?.addEventListener('click', () => navigateTo('patient'));
    document.getElementById('showTreatmentsBtn')?.addEventListener('click', openTreatmentModal);
    document.getElementById('viewTreatmentChartBtn')?.addEventListener('click', openTreatmentModal);
    document.getElementById('addPatientForm')?.addEventListener('submit', registerPatient);
    document.getElementById('searchPatientBtn')?.addEventListener('click', searchPatient);
    document.getElementById('searchPatientNameBtn')?.addEventListener('click', searchPatientByName);
    document.getElementById('searchDoctorBtn')?.addEventListener('click', searchDoctor);
    document.getElementById('searchAppointmentBtn')?.addEventListener('click', searchAppointment);
    document.getElementById('newAppointmentForm')?.addEventListener('submit', bookAppointment);
    const data = await fetchAllData();
    if (data) {
        navigateTo('home');
        // Silently preload treatment bar so stats show without clicking
        apiGet('/analytics/stats/treatments-summary')
            .then(d => { if (d?.breakdown) populateHomeTreatmentBar(d.breakdown, d.totals); })
            .catch(() => {});
    }
    else document.querySelector('.container').innerHTML =
        '<div class="card" style="text-align:center"><h2>⚠️ Backend Not Connected</h2>' +
        '<p>Please start the backend server with: <code>node server.js</code></p></div>';
}
init();