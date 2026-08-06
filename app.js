// ---------- CONFIGURACIÓN DE FIREBASE ----------

const firebaseConfig = {
  apiKey: "AIzaSyDldirsikPbqjoCHzHtMt943iYIc03Fhws",
  authDomain: "calendario-editorial-dfp.firebaseapp.com",
  projectId: "calendario-editorial-dfp",
  storageBucket: "calendario-editorial-dfp.firebasestorage.app",
  messagingSenderId: "278365011036",
  appId: "1:278365011036:web:6c4fd92abdce7e9fb5fa99"
};

firebase.initializeApp(firebaseConfig);
const db = firebase.firestore();

//Esperamos que todo el HTML esté cargado antes de ejecutar el script
document.addEventListener('DOMContentLoaded',() => {

    //Seleccionamos todos los botones de las pestañas
    const tabButtons = document.querySelectorAll('.tab-btn');

    //Seleccionamos todas las secciones de contenido
    const tabContents = document.querySelectorAll('.tab-content');

    //Agregamos un evento de click a cada botón de pestaña
    tabButtons.forEach(button => {
        button.addEventListener('click', () => {
            tabButtons.forEach(btn => btn.classList.remove('active'));
            button.classList.add('active');
            const targetTab = button.dataset.tab;
            tabContents.forEach(section => section.classList.remove('active'));
            document.getElementById(targetTab).classList.add('active');
        });
    });

    function mostrarToast(mensaje, tipo = 'exito') {
        const toast = document.getElementById('toast');
        toast.textContent = mensaje;
        toast.className = 'toast mostrar ' + tipo; // reinicia las clases y agrega las actuales

        // se oculta después de 3 segundos
        setTimeout(() => {
            toast.classList.remove('mostrar');
        }, 3000);
    }

// ---------- LÓGICA DEL FORMULARIO ----------

    const form = document.getElementById('registro-form');

    let registrosCache = []; // aquí Firestore mantiene la copia más reciente de los datos

    // Nos "suscribimos" a la colección: esta función se ejecuta sola
    // cada vez que hay un cambio en Firestore, venga de quien venga
    db.collection('registros').onSnapshot((snapshot) => {
        registrosCache = snapshot.docs.map(doc => ({
            id: doc.id,
            ...doc.data()
        }));
        renderizarTabla();
        actualizarDashboard();
    });

    function obtenerRegistros() {
        return registrosCache;
    }

    let idEditando = null; // null = modo agregar, número = modo editar

    const MESES_ORDEN = ["Enero","Febrero","Marzo","Abril","Mayo","Junio","Julio",
                         "Agosto","Septiembre","Octubre","Noviembre","Diciembre"];

// ------- Lógica de la Tabla ----------
// Defina aquí, ya que la función renderizarTabla() se llama antes de su definición

const tablaBody = document.getElementById('tabla-body');

function claseEstado(estado) {
    return 'badge-' + estado.toLowerCase().replace(/ /g, '-');
}

function renderizarTabla() {
    let registros = obtenerRegistros();

    // Ordenamos siempre por mes, en orden de calendario
    registros.sort((a, b) => MESES_ORDEN.indexOf(a.mes) - MESES_ORDEN.indexOf(b.mes));

    // Aplicamos los filtros activos, si hay alguno seleccionado
    const filtroMes = document.getElementById('filtro-mes').value;
    const filtroEstado = document.getElementById('filtro-estado').value;

    if (filtroMes) {
        registros = registros.filter(r => r.mes === filtroMes);
    }
    if (filtroEstado) {
        registros = registros.filter(r => r.estado === filtroEstado);
    }

    tablaBody.innerHTML = '';

    registros.forEach(registro => {
        const fila = document.createElement('tr');

        fila.innerHTML = `
            <td>${registro.mes}</td>
            <td>${registro.semana}</td>
            <td>${registro.categoria}</td>
            <td>${registro.red}</td>
            <td>${registro.tipo}</td>
            <td>${registro.titulo}</td>
            <td>${registro.autor}</td>
            <td><span class="badge ${claseEstado(registro.estado)}">${registro.estado}</span></td>
            <td>
            <button class="btn-editar" data-id="${registro.id}">Editar</button>
            <button class="btn-eliminar" data-id="${registro.id}">Eliminar</button>
            </td>
        `;

        tablaBody.appendChild(fila);
    });
}

document.getElementById('filtro-mes').addEventListener('change', renderizarTabla);
document.getElementById('filtro-estado').addEventListener('change', renderizarTabla);

document.getElementById('btn-limpiar-filtros').addEventListener('click', () => {
    document.getElementById('filtro-mes').value = '';
    document.getElementById('filtro-estado').value = '';
    renderizarTabla();
});

document.getElementById('btn-exportar').addEventListener('click', () => {
        const registros = obtenerRegistros();

        if (registros.length === 0) {
            mostrarToast('No hay registros para exportar', 'error');
            return;
        }

        // Transformamos cada registro a un objeto con nombres de columna "bonitos"
        const datosParaExcel = registros.map(r => ({
            "Mes": r.mes,
            "Semana": r.semana,
            "Categoría": r.categoria,
            "Plataforma": r.red,
            "Tipo de pieza": r.tipo,
            "Título / Descripción": r.titulo,
            "Autor": r.autor,
            "Estado": r.estado,
            "Notas": r.notas
        }));

        // Creamos la hoja y el libro de Excel
        const hoja = XLSX.utils.json_to_sheet(datosParaExcel);
        const libro = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(libro, hoja, "Calendario Editorial");

        // Ajustamos el ancho de las columnas para que se lea bien
        hoja['!cols'] = [
            { wch: 12 }, // Mes
            { wch: 10 }, // Semana
            { wch: 20 }, // Categoría
            { wch: 18 }, // Plataforma
            { wch: 22 }, // Tipo de pieza
            { wch: 35 }, // Título
            { wch: 16 }, // Autor
            { wch: 14 }, // Estado
            { wch: 35 }  // Notas
        ];

        // Generamos el nombre del archivo con la fecha de hoy
        const hoy = new Date().toISOString().split('T')[0]; // formato AAAA-MM-DD
        const nombreArchivo = `Calendario_Editorial_DFP_${hoy}.xlsx`;

        XLSX.writeFile(libro, nombreArchivo);
        mostrarToast('Excel exportado exitosamente');
    });

tablaBody.addEventListener('click', (e) => {
    if (e.target.classList.contains('btn-eliminar')) {
            const idAEliminar = e.target.dataset.id; // ya no usamos Number(), el id de Firestore es texto
            db.collection('registros').doc(idAEliminar).delete()
                .then(() => {
                    mostrarToast('Registro eliminado', 'error');
                })
                .catch((error) => {
                    mostrarToast('Error al eliminar', 'error');
                    console.error(error);
                });
        }

if (e.target.classList.contains('btn-editar')) {
        const idAEditar = e.target.dataset.id; // texto, no número
        const registros = obtenerRegistros();
        const registro = registros.find(r => r.id === idAEditar);

    // Llenamos el formulario con los datos del registro a editar
    document.getElementById('mes').value = registro.mes;
    document.getElementById('semana').value = registro.semana;
    document.getElementById('categoria').value = registro.categoria;
    document.getElementById('red').value = registro.red;
    document.getElementById('tipo').value = registro.tipo;
    document.getElementById('titulo').value = registro.titulo;
    document.getElementById('autor').value = registro.autor;
    document.getElementById('estado').value = registro.estado;
    document.getElementById('notas').value = registro.notas;

    //Activamos el modo edición
    idEditando = idAEditar;
    document.querySelector('.btn-primary').textContent = 'Actualizar Registro';

    // Cambiamos a la pestaña del formulario
    document.querySelector('[data-tab="formulario"]').click();
}
});

// ---------- LÓGICA DEL DASHBOARD ----------
    let graficaMensual = null; // aquí guardaremos la instancia de Chart.js

    function actualizarDashboard() {
        const registros = obtenerRegistros();

        const total = registros.length;
        const publicadas = registros.filter(r => r.estado === "Publicado").length;
        const atrasadas = registros.filter(r => r.estado === "Atrasado" || r.estado === "Pendiente").length;
        const cumplimiento = total === 0 ? 0 : Math.round((publicadas / total) * 100);

        document.getElementById('kpi-total').textContent = total;
        document.getElementById('kpi-publicadas').textContent = publicadas;
        document.getElementById('kpi-pendientes').textContent = atrasadas;
        document.getElementById('kpi-cumplimiento').textContent = cumplimiento + '%';

        // Contamos planificadas y publicadas por cada mes
        const planificadasPorMes = MESES_ORDEN.map(mes =>
            registros.filter(r => r.mes === mes).length
        );
        const publicadasPorMes = MESES_ORDEN.map(mes =>
            registros.filter(r => r.mes === mes && r.estado === "Publicado").length
        );

        const ctx = document.getElementById('grafica-mensual');

        // Si ya existe una gráfica dibujada, la destruimos antes de crear otra
        if (graficaMensual) {
            graficaMensual.destroy();
        }

        graficaMensual = new Chart(ctx, {
            type: 'bar',
            data: {
                labels: MESES_ORDEN,
                datasets: [
                    {
                        label: 'Planificadas',
                        data: planificadasPorMes,
                        backgroundColor: '#4993cc'
                    },
                    {
                        label: 'Publicadas',
                        data: publicadasPorMes,
                        backgroundColor: '#6eb400'
                    }
                ]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                scales: {
                    y: {
                        beginAtZero: true,
                        ticks: { stepSize: 1 }
                    }
                }
            }
        });
    }

// ----- Evento Submit del Formulario -----

form.addEventListener('submit', (e) => {
    e.preventDefault();

    const datosFormulario = {
        mes: document.getElementById('mes').value,
        semana: document.getElementById('semana').value,
        categoria: document.getElementById('categoria').value,
        red: document.getElementById('red').value,
        tipo: document.getElementById('tipo').value,
        titulo: document.getElementById('titulo').value,
        autor: document.getElementById('autor').value,
        estado: document.getElementById('estado').value,
        notas: document.getElementById('notas').value
    };

    if (idEditando === null) {
        // Modo agregar: Firestore genera el id solo
        db.collection('registros').add(datosFormulario)
            .then(() => {
                mostrarToast('Registro agregado exitosamente');
            })
            .catch((error) => {
                mostrarToast('Error al agregar', 'error');
                console.error(error);
            });
    } else {
        // Modo editar: actualizamos el documento existente por su id
        db.collection('registros').doc(idEditando).update(datosFormulario)
            .then(() => {
                mostrarToast('Registro actualizado exitosamente');
            })
            .catch((error) => {
                mostrarToast('Error al actualizar', 'error');
                console.error(error);
            });
    }

    form.reset();
    idEditando = null;
    document.querySelector('.btn-primary').textContent = 'Agregar Registro';
});
    


});