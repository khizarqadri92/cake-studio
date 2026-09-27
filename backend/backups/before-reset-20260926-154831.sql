--
-- PostgreSQL database dump
--

\restrict v89CUIf98NnigJMsTpAD7jxBKJm33xMFBcT92dIeOAFQLGKNIdYfogVU4Tsoll5

-- Dumped from database version 18.4
-- Dumped by pg_dump version 18.4

SET statement_timeout = 0;
SET lock_timeout = 0;
SET idle_in_transaction_session_timeout = 0;
SET transaction_timeout = 0;
SET client_encoding = 'UTF8';
SET standard_conforming_strings = on;
SELECT pg_catalog.set_config('search_path', '', false);
SET check_function_bodies = false;
SET xmloption = content;
SET client_min_messages = warning;
SET row_security = off;

--
-- Name: overrideeffect; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public.overrideeffect AS ENUM (
    'GRANT',
    'DENY'
);


SET default_tablespace = '';

SET default_table_access_method = heap;

--
-- Name: accesspolicy; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.accesspolicy (
    id integer NOT NULL,
    default_role_id uuid,
    password_min_length integer DEFAULT 8 NOT NULL,
    password_require_uppercase boolean DEFAULT true NOT NULL,
    password_require_number boolean DEFAULT true NOT NULL,
    password_require_symbol boolean DEFAULT false NOT NULL,
    password_expiry_days integer DEFAULT 0 NOT NULL,
    max_login_attempts integer DEFAULT 5 NOT NULL,
    lockout_duration_minutes integer DEFAULT 15 NOT NULL,
    session_timeout_minutes integer DEFAULT 480 NOT NULL,
    two_factor_required boolean DEFAULT false NOT NULL,
    ip_allowlist character varying,
    updated_at timestamp with time zone NOT NULL
);


--
-- Name: accesspolicy_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.accesspolicy_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: accesspolicy_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.accesspolicy_id_seq OWNED BY public.accesspolicy.id;


--
-- Name: alembic_version; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.alembic_version (
    version_num character varying(32) NOT NULL
);


--
-- Name: auditlog; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.auditlog (
    id uuid NOT NULL,
    actor_staff_id uuid,
    action character varying NOT NULL,
    target_type character varying,
    target_id character varying,
    details json,
    ip_address character varying,
    created_at timestamp with time zone NOT NULL
);


--
-- Name: branch; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.branch (
    id uuid NOT NULL,
    name character varying NOT NULL,
    code character varying NOT NULL,
    address_line1 character varying,
    address_line2 character varying,
    city character varying,
    state character varying,
    country character varying,
    postal_code character varying,
    phone character varying,
    email character varying,
    manager_staff_id uuid,
    business_hours json NOT NULL,
    timezone character varying DEFAULT 'Asia/Karachi'::character varying NOT NULL,
    currency character varying DEFAULT 'PKR'::character varying NOT NULL,
    is_active boolean DEFAULT true NOT NULL,
    is_default boolean DEFAULT false NOT NULL,
    created_at timestamp with time zone NOT NULL
);


--
-- Name: branchfieldaccess; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.branchfieldaccess (
    id uuid NOT NULL,
    role_id uuid NOT NULL,
    branch_id uuid NOT NULL,
    section_key character varying NOT NULL,
    field_key character varying NOT NULL,
    access_level character varying DEFAULT 'disable'::character varying NOT NULL
);


--
-- Name: cakeaddon; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.cakeaddon (
    id uuid NOT NULL,
    name character varying NOT NULL,
    description character varying,
    price double precision DEFAULT '0'::double precision NOT NULL,
    max_qty integer DEFAULT 1 NOT NULL,
    image_url character varying,
    is_active boolean DEFAULT true NOT NULL,
    sort_order integer DEFAULT 0 NOT NULL
);


--
-- Name: cakebox; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.cakebox (
    id uuid NOT NULL,
    name character varying NOT NULL,
    description character varying,
    price_modifier double precision DEFAULT '0'::double precision NOT NULL,
    image_url character varying,
    is_active boolean DEFAULT true NOT NULL,
    sort_order integer DEFAULT 0 NOT NULL
);


--
-- Name: cakecolor; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.cakecolor (
    id uuid NOT NULL,
    name character varying NOT NULL,
    description character varying,
    price_modifier double precision DEFAULT '0'::double precision NOT NULL,
    image_url character varying,
    is_active boolean DEFAULT true NOT NULL,
    sort_order integer DEFAULT 0 NOT NULL
);


--
-- Name: cakefilling; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.cakefilling (
    id uuid NOT NULL,
    name character varying NOT NULL,
    description character varying,
    price_modifier double precision DEFAULT '0'::double precision NOT NULL,
    image_url character varying,
    is_active boolean DEFAULT true NOT NULL,
    sort_order integer DEFAULT 0 NOT NULL
);


--
-- Name: cakeflavor; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.cakeflavor (
    id uuid NOT NULL,
    name character varying NOT NULL,
    description character varying,
    price_modifier double precision DEFAULT '0'::double precision NOT NULL,
    image_url character varying,
    is_active boolean DEFAULT true NOT NULL,
    sort_order integer DEFAULT 0 NOT NULL
);


--
-- Name: cakefrosting; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.cakefrosting (
    id uuid NOT NULL,
    name character varying NOT NULL,
    description character varying,
    price_modifier double precision DEFAULT '0'::double precision NOT NULL,
    image_url character varying,
    is_active boolean DEFAULT true NOT NULL,
    sort_order integer DEFAULT 0 NOT NULL
);


--
-- Name: cakeshape; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.cakeshape (
    id uuid NOT NULL,
    name character varying NOT NULL,
    description character varying,
    price_modifier double precision DEFAULT '0'::double precision NOT NULL,
    image_url character varying,
    is_active boolean DEFAULT true NOT NULL,
    sort_order integer DEFAULT 0 NOT NULL
);


--
-- Name: cakesize; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.cakesize (
    id uuid NOT NULL,
    name character varying NOT NULL,
    servings integer,
    price_modifier double precision DEFAULT '0'::double precision NOT NULL,
    is_active boolean DEFAULT true NOT NULL,
    sort_order integer DEFAULT 0 NOT NULL
);


--
-- Name: caketier; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.caketier (
    id uuid NOT NULL,
    name character varying NOT NULL,
    description character varying,
    price_modifier double precision DEFAULT '0'::double precision NOT NULL,
    image_url character varying,
    is_active boolean DEFAULT true NOT NULL,
    sort_order integer DEFAULT 0 NOT NULL
);


--
-- Name: customer; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.customer (
    id uuid NOT NULL,
    full_name character varying NOT NULL,
    phone character varying NOT NULL,
    email character varying,
    address_line1 character varying,
    city character varying,
    notes character varying,
    created_at timestamp with time zone NOT NULL
);


--
-- Name: deliveryzone; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.deliveryzone (
    id uuid NOT NULL,
    name character varying,
    distance_from_km double precision NOT NULL,
    distance_to_km double precision NOT NULL,
    price double precision DEFAULT '0'::double precision NOT NULL,
    is_active boolean DEFAULT true NOT NULL,
    sort_order integer DEFAULT 0 NOT NULL
);


--
-- Name: employeecodesettings; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.employeecodesettings (
    id integer NOT NULL,
    prefix character varying DEFAULT 'EMP'::character varying NOT NULL,
    separator character varying DEFAULT '-'::character varying NOT NULL,
    padding integer DEFAULT 4 NOT NULL,
    include_year boolean DEFAULT false NOT NULL,
    next_sequence integer DEFAULT 1 NOT NULL,
    updated_at timestamp with time zone NOT NULL
);


--
-- Name: employeecodesettings_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.employeecodesettings_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: employeecodesettings_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.employeecodesettings_id_seq OWNED BY public.employeecodesettings.id;


--
-- Name: expense; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.expense (
    id uuid NOT NULL,
    category character varying NOT NULL,
    amount double precision NOT NULL,
    description character varying,
    processing_date date NOT NULL,
    recorded_by_staff_id uuid NOT NULL
);


--
-- Name: inventoryitem; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.inventoryitem (
    id uuid NOT NULL,
    name character varying NOT NULL,
    unit character varying,
    qty_on_hand double precision DEFAULT '0'::double precision NOT NULL,
    reorder_threshold double precision DEFAULT '0'::double precision NOT NULL,
    supplier_id uuid,
    is_active boolean DEFAULT true NOT NULL,
    unit_id uuid
);


--
-- Name: loginhistory; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.loginhistory (
    id uuid NOT NULL,
    attempted_email character varying NOT NULL,
    staff_id uuid,
    success boolean NOT NULL,
    failure_reason character varying,
    ip_address character varying,
    user_agent character varying,
    created_at timestamp with time zone NOT NULL
);


--
-- Name: order; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public."order" (
    id uuid NOT NULL,
    order_number character varying NOT NULL,
    customer_id uuid NOT NULL,
    branch_id uuid,
    status character varying DEFAULT 'draft'::character varying NOT NULL,
    fulfillment_type character varying DEFAULT 'pickup'::character varying NOT NULL,
    delivery_zone_id uuid,
    delivery_address character varying,
    delivery_date date NOT NULL,
    delivery_time character varying,
    subtotal double precision DEFAULT '0'::double precision NOT NULL,
    delivery_charge double precision DEFAULT '0'::double precision NOT NULL,
    discount double precision DEFAULT '0'::double precision NOT NULL,
    total double precision DEFAULT '0'::double precision NOT NULL,
    advance_paid double precision DEFAULT '0'::double precision NOT NULL,
    notes character varying,
    created_by_staff_id uuid NOT NULL,
    created_at timestamp with time zone NOT NULL,
    confirmed_at timestamp with time zone,
    confirmed_by_staff_id uuid,
    sent_to_baker_at timestamp with time zone,
    sent_to_baker_by_staff_id uuid,
    baker_staff_id uuid,
    production_started_at timestamp with time zone,
    ready_at timestamp with time zone,
    rider_staff_id uuid,
    assigned_rider_at timestamp with time zone,
    amount_received double precision,
    handover_at timestamp with time zone,
    handover_by_staff_id uuid,
    baker_accepted_at timestamp with time zone,
    decline_reason character varying,
    declined_at timestamp with time zone,
    declined_by_staff_id uuid,
    delivery_started_at timestamp with time zone,
    delivered_at timestamp with time zone,
    rider_amount_collected double precision,
    business_date date
);


--
-- Name: orderingredientusage; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.orderingredientusage (
    id uuid NOT NULL,
    order_id uuid NOT NULL,
    inventory_item_id uuid NOT NULL,
    quantity_used double precision NOT NULL,
    recorded_by_staff_id uuid NOT NULL,
    recorded_at timestamp with time zone NOT NULL,
    entered_quantity double precision,
    entered_unit character varying,
    processing_date date
);


--
-- Name: orderitem; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.orderitem (
    id uuid NOT NULL,
    order_id uuid NOT NULL,
    cake_flavor_id uuid,
    cake_filling_id uuid,
    cake_frosting_id uuid,
    cake_shape_id uuid,
    cake_size_id uuid,
    theme_id uuid,
    cake_box_id uuid,
    custom_message character varying,
    special_instructions character varying,
    quantity integer DEFAULT 1 NOT NULL,
    unit_price double precision DEFAULT '0'::double precision NOT NULL,
    line_total double precision DEFAULT '0'::double precision NOT NULL,
    cake_tier_id uuid,
    is_customer_design boolean DEFAULT false NOT NULL,
    reference_image_url character varying,
    cake_color_id uuid
);


--
-- Name: orderitemaddon; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.orderitemaddon (
    id uuid NOT NULL,
    order_item_id uuid NOT NULL,
    addon_id uuid NOT NULL,
    quantity integer DEFAULT 1 NOT NULL,
    unit_price double precision DEFAULT '0'::double precision NOT NULL
);


--
-- Name: ordersequence; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.ordersequence (
    id integer NOT NULL,
    next_number integer DEFAULT 1 NOT NULL
);


--
-- Name: ordersequence_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.ordersequence_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: ordersequence_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.ordersequence_id_seq OWNED BY public.ordersequence.id;


--
-- Name: organization; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.organization (
    id integer NOT NULL,
    company_name character varying DEFAULT 'Cake Studio'::character varying NOT NULL,
    legal_name character varying,
    registration_number character varying,
    tax_number character varying,
    business_type character varying,
    industry character varying,
    logo_url character varying,
    favicon_url character varying,
    address_line1 character varying,
    address_line2 character varying,
    city character varying,
    state character varying,
    country character varying,
    postal_code character varying,
    phone_primary character varying,
    phone_secondary character varying,
    email_primary character varying,
    email_secondary character varying,
    website_url character varying,
    business_hours json NOT NULL,
    timezone character varying DEFAULT 'Asia/Karachi'::character varying NOT NULL,
    default_language character varying DEFAULT 'en'::character varying NOT NULL,
    default_currency character varying DEFAULT 'PKR'::character varying NOT NULL,
    date_format character varying DEFAULT 'DD/MM/YYYY'::character varying NOT NULL,
    number_format character varying DEFAULT '1,234.56'::character varying NOT NULL,
    updated_at timestamp with time zone NOT NULL,
    time_format character varying DEFAULT 'hh:mm A'::character varying NOT NULL
);


--
-- Name: organization_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.organization_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: organization_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.organization_id_seq OWNED BY public.organization.id;


--
-- Name: permission; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.permission (
    id uuid NOT NULL,
    key character varying NOT NULL,
    description character varying
);


--
-- Name: printjob; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.printjob (
    id uuid NOT NULL,
    order_id uuid NOT NULL,
    kind character varying DEFAULT 'kitchen_ticket'::character varying NOT NULL,
    reason character varying DEFAULT 'confirmation'::character varying NOT NULL,
    mode character varying NOT NULL,
    status character varying NOT NULL,
    error character varying,
    printer character varying,
    created_by_staff_id uuid,
    created_at timestamp with time zone NOT NULL
);


--
-- Name: processingdatelog; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.processingdatelog (
    id uuid NOT NULL,
    old_date date NOT NULL,
    new_date date NOT NULL,
    changed_by_staff_id uuid NOT NULL,
    reason character varying,
    changed_at timestamp with time zone NOT NULL
);


--
-- Name: purchase; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.purchase (
    id uuid NOT NULL,
    supplier_id uuid,
    invoice_number character varying,
    purchase_date date NOT NULL,
    notes character varying,
    total_amount double precision DEFAULT '0'::double precision NOT NULL,
    created_by_staff_id uuid NOT NULL,
    created_at timestamp with time zone NOT NULL
);


--
-- Name: purchaseitem; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.purchaseitem (
    id uuid NOT NULL,
    purchase_id uuid NOT NULL,
    inventory_item_id uuid NOT NULL,
    quantity double precision NOT NULL,
    unit_price double precision NOT NULL,
    line_total double precision NOT NULL,
    entered_quantity double precision,
    entered_unit character varying,
    entered_unit_price double precision
);


--
-- Name: recipe; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.recipe (
    id uuid NOT NULL,
    name character varying NOT NULL
);


--
-- Name: recipeitem; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.recipeitem (
    id uuid NOT NULL,
    recipe_id uuid NOT NULL,
    inventory_item_id uuid NOT NULL,
    qty_required double precision NOT NULL
);


--
-- Name: role; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.role (
    id uuid NOT NULL,
    name character varying NOT NULL,
    description character varying
);


--
-- Name: rolepermission; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.rolepermission (
    role_id uuid NOT NULL,
    permission_id uuid NOT NULL
);


--
-- Name: staff; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.staff (
    id uuid NOT NULL,
    full_name character varying NOT NULL,
    email character varying NOT NULL,
    hashed_password character varying NOT NULL,
    is_active boolean DEFAULT true NOT NULL,
    created_at timestamp with time zone NOT NULL,
    failed_login_attempts integer DEFAULT 0 NOT NULL,
    locked_until timestamp with time zone,
    password_updated_at timestamp with time zone NOT NULL,
    totp_secret character varying,
    totp_enabled boolean DEFAULT false NOT NULL,
    password_changed_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    must_change_password boolean DEFAULT false NOT NULL,
    two_factor_enabled boolean DEFAULT false NOT NULL,
    two_factor_secret character varying,
    preferred_language character varying,
    theme_preference character varying,
    color_palette character varying,
    phone character varying,
    job_title character varying,
    employee_code character varying,
    date_of_joining date,
    branch_id uuid,
    department character varying,
    date_of_birth date,
    gender character varying,
    national_id character varying,
    employment_type character varying,
    basic_salary double precision,
    address_line1 character varying,
    city character varying,
    country character varying,
    emergency_contact_name character varying,
    emergency_contact_phone character varying
);


--
-- Name: staffpermissionoverride; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.staffpermissionoverride (
    staff_id uuid NOT NULL,
    permission_id uuid NOT NULL,
    effect character varying DEFAULT 'grant'::character varying NOT NULL,
    reason character varying
);


--
-- Name: staffrole; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.staffrole (
    staff_id uuid NOT NULL,
    role_id uuid NOT NULL
);


--
-- Name: stockmovement; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.stockmovement (
    id uuid NOT NULL,
    inventory_item_id uuid NOT NULL,
    qty_delta double precision NOT NULL,
    reason character varying NOT NULL,
    processing_date date NOT NULL,
    created_by_staff_id uuid NOT NULL,
    created_at timestamp with time zone NOT NULL,
    unit_price double precision,
    purchase_id uuid
);


--
-- Name: supplier; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.supplier (
    id uuid NOT NULL,
    name character varying NOT NULL,
    contact_phone character varying
);


--
-- Name: systemconfig; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.systemconfig (
    id integer NOT NULL,
    current_processing_date date NOT NULL,
    fiscal_year_start_month integer DEFAULT 1 NOT NULL,
    is_day_locked boolean DEFAULT false NOT NULL,
    updated_at timestamp with time zone NOT NULL,
    amount_decimals integer DEFAULT 2 NOT NULL,
    quantity_decimals integer DEFAULT 3 NOT NULL,
    printer_mode character varying DEFAULT 'browser'::character varying NOT NULL,
    printer_host character varying,
    printer_port integer DEFAULT 9100 NOT NULL,
    printer_width integer DEFAULT 48 NOT NULL,
    phone_country_code character varying DEFAULT '92'::character varying NOT NULL,
    date_mode character varying DEFAULT 'processing'::character varying NOT NULL
);


--
-- Name: systemconfig_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.systemconfig_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: systemconfig_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.systemconfig_id_seq OWNED BY public.systemconfig.id;


--
-- Name: theme; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.theme (
    id uuid NOT NULL,
    name character varying NOT NULL,
    description character varying,
    image_url character varying,
    is_active boolean DEFAULT true NOT NULL,
    sort_order integer DEFAULT 0 NOT NULL
);


--
-- Name: unitofmeasure; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.unitofmeasure (
    id uuid NOT NULL,
    name character varying NOT NULL,
    abbreviation character varying NOT NULL,
    is_active boolean DEFAULT true NOT NULL,
    sort_order integer DEFAULT 0 NOT NULL,
    measure character varying,
    factor double precision DEFAULT '1'::double precision NOT NULL
);


--
-- Name: accesspolicy id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.accesspolicy ALTER COLUMN id SET DEFAULT nextval('public.accesspolicy_id_seq'::regclass);


--
-- Name: employeecodesettings id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.employeecodesettings ALTER COLUMN id SET DEFAULT nextval('public.employeecodesettings_id_seq'::regclass);


--
-- Name: ordersequence id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.ordersequence ALTER COLUMN id SET DEFAULT nextval('public.ordersequence_id_seq'::regclass);


--
-- Name: organization id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.organization ALTER COLUMN id SET DEFAULT nextval('public.organization_id_seq'::regclass);


--
-- Name: systemconfig id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.systemconfig ALTER COLUMN id SET DEFAULT nextval('public.systemconfig_id_seq'::regclass);


--
-- Data for Name: accesspolicy; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.accesspolicy (id, default_role_id, password_min_length, password_require_uppercase, password_require_number, password_require_symbol, password_expiry_days, max_login_attempts, lockout_duration_minutes, session_timeout_minutes, two_factor_required, ip_allowlist, updated_at) FROM stdin;
1	\N	8	t	t	t	0	5	2	480	f	\N	2026-08-13 19:44:30.163695+05
\.


--
-- Data for Name: alembic_version; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.alembic_version (version_num) FROM stdin;
0028
\.


--
-- Data for Name: auditlog; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.auditlog (id, actor_staff_id, action, target_type, target_id, details, ip_address, created_at) FROM stdin;
9aaa5ed8-e888-41ff-b3dd-1ed6b36e9530	33b6d222-3061-41e3-b558-fa682996e17f	password.changed	staff	33b6d222-3061-41e3-b558-fa682996e17f	null	\N	2026-08-12 18:04:30.757081+05
85b60bdf-5236-4763-8909-6f3f9ed97d46	33b6d222-3061-41e3-b558-fa682996e17f	2fa.enabled	staff	33b6d222-3061-41e3-b558-fa682996e17f	null	\N	2026-08-12 18:06:26.013738+05
cb7aefc2-481f-489d-b23f-65775bebefd9	33b6d222-3061-41e3-b558-fa682996e17f	role.permissions_changed	role	cfa36ef0-652c-47e0-9dbe-b07bcd899dae	{"permission_keys": []}	\N	2026-08-12 18:08:05.89833+05
90c4619c-12b4-44c1-bc8b-5666ea063d3b	33b6d222-3061-41e3-b558-fa682996e17f	role.permissions_changed	role	644cb2d7-3dd9-447e-a234-081c2c19d0cf	{"permission_keys": []}	\N	2026-08-12 18:08:06.787737+05
5976e2c8-88cb-4835-9b91-84090a94709e	33b6d222-3061-41e3-b558-fa682996e17f	role.permissions_changed	role	0b159d94-a3f8-42ed-bf14-045eb38ea287	{"permission_keys": []}	\N	2026-08-12 18:08:07.388912+05
be9f94a3-fdb4-4057-ad7a-78a97efdd9fe	33b6d222-3061-41e3-b558-fa682996e17f	role.permissions_changed	role	377880a9-5e4c-48ff-9e4d-44f132caf6ed	{"permission_keys": []}	\N	2026-08-12 18:08:58.318662+05
47b9088a-b282-499e-a593-ddcf5205b7c0	33b6d222-3061-41e3-b558-fa682996e17f	2fa.disabled	staff	33b6d222-3061-41e3-b558-fa682996e17f	null	\N	2026-08-13 13:04:58.817419+05
d83e6ee6-42f7-4b8d-b797-9d73c44d17f3	33b6d222-3061-41e3-b558-fa682996e17f	role.permissions_changed	role	377880a9-5e4c-48ff-9e4d-44f132caf6ed	{"permission_keys": []}	\N	2026-08-13 13:06:14.439977+05
ac2c17fc-a20d-4880-bf3e-1c737788df47	33b6d222-3061-41e3-b558-fa682996e17f	role.permissions_changed	role	377880a9-5e4c-48ff-9e4d-44f132caf6ed	{"permission_keys": []}	\N	2026-08-13 13:06:49.296945+05
ecb9a335-9d1c-41b8-8a20-9ed8a617189a	33b6d222-3061-41e3-b558-fa682996e17f	staff.created	staff	ab242ada-05ef-4ed4-94bf-b300bc8c05dd	null	\N	2026-08-13 13:13:46.097643+05
0eeb9dd9-61ad-4424-8183-6a116a6b81e3	33b6d222-3061-41e3-b558-fa682996e17f	role.deleted	role	dba430e3-c4ef-4574-a87a-d274ae6074fc	{"name": "Employee"}	\N	2026-08-13 13:14:52.153039+05
99eaae1f-1c84-4570-b596-520a86861821	33b6d222-3061-41e3-b558-fa682996e17f	role.deleted	role	64b2ef3c-ae1b-4cd2-8ad9-8f22bce29e48	{"name": "Superadmin"}	\N	2026-08-13 13:14:59.058868+05
092c768b-95be-4716-9615-fffa9005264b	33b6d222-3061-41e3-b558-fa682996e17f	staff.status_changed	staff	ab242ada-05ef-4ed4-94bf-b300bc8c05dd	{"is_active": false}	\N	2026-08-14 16:58:34.81366+05
40d9ab93-ba4e-4b84-8cb0-3b227c499a07	33b6d222-3061-41e3-b558-fa682996e17f	staff.status_changed	staff	ab242ada-05ef-4ed4-94bf-b300bc8c05dd	{"is_active": true}	\N	2026-08-14 16:58:37.340732+05
530b5476-d021-4501-80da-8cbd3ba7d229	33b6d222-3061-41e3-b558-fa682996e17f	role.permissions_changed	role	36dfa0ab-e22e-476a-89a3-e5d390f77d33	{"permission_keys": ["access_policy.field.edit", "access_policy.page.view", "audit_trail.page.view", "branches.button.create", "branches.field.details.edit", "branches.field.hours.edit", "branches.field.status.edit", "branches.page.view", "login_history.page.view", "organization.field.branding.edit", "organization.field.contact.edit", "organization.field.hours.edit", "organization.field.identity.edit", "organization.field.locale.edit", "organization.page.view", "permissions.page.view", "permissions.role.assign_permission", "permissions.role.create", "permissions.role.delete", "permissions.role.edit", "permissions.staffoverride.edit", "staff.button.create", "staff.field.role.edit", "staff.field.status.edit", "system.config.field.business_name.edit", "system.config.field.processing_date.edit", "system.config.field.timezone.edit", "system.config.page.view"]}	\N	2026-08-14 16:58:53.071813+05
f9785835-9de1-49a1-9425-087064f36926	33b6d222-3061-41e3-b558-fa682996e17f	role.permissions_changed	role	cfa36ef0-652c-47e0-9dbe-b07bcd899dae	{"permission_keys": ["staff.page.view"]}	\N	2026-08-14 16:59:03.797276+05
fe28abaf-16f0-49c3-8c7f-f0b18efe4c02	33b6d222-3061-41e3-b558-fa682996e17f	role.permissions_changed	role	36dfa0ab-e22e-476a-89a3-e5d390f77d33	{"permission_keys": ["access_policy.field.edit", "access_policy.page.view", "audit_trail.page.view", "branches.button.create", "branches.field.details.edit", "branches.field.hours.edit", "branches.field.status.edit", "branches.page.view", "login_history.page.view", "organization.field.branding.edit", "organization.field.contact.edit", "organization.field.hours.edit", "organization.field.identity.edit", "organization.field.locale.edit", "organization.page.view", "permissions.page.view", "permissions.role.assign_permission", "permissions.role.create", "permissions.role.delete", "permissions.role.edit", "permissions.staffoverride.edit", "staff.button.create", "staff.field.role.edit", "staff.field.status.edit", "system.config.field.business_name.edit", "system.config.field.processing_date.edit", "system.config.field.timezone.edit", "system.config.page.view", "staff.page.view"]}	\N	2026-08-14 16:59:20.230872+05
ebcadb39-a25b-4b0e-8034-4895a6f13f63	33b6d222-3061-41e3-b558-fa682996e17f	role.permissions_changed	role	36dfa0ab-e22e-476a-89a3-e5d390f77d33	{"permission_keys": ["audit_trail.page.view", "branches.button.create", "branches.field.details.edit", "branches.field.hours.edit", "branches.field.status.edit", "branches.page.view", "login_history.page.view", "organization.field.branding.edit", "organization.field.contact.edit", "organization.field.hours.edit", "organization.field.identity.edit", "organization.field.locale.edit", "organization.page.view", "permissions.page.view", "permissions.role.assign_permission", "permissions.role.create", "permissions.role.delete", "permissions.role.edit", "permissions.staffoverride.edit", "staff.button.create", "staff.field.role.edit", "staff.field.status.edit", "staff.page.view", "system.config.field.business_name.edit", "system.config.field.processing_date.edit", "system.config.field.timezone.edit", "system.config.page.view"]}	\N	2026-08-14 17:01:08.761609+05
b9c03544-f184-419a-be09-242de7e4673a	33b6d222-3061-41e3-b558-fa682996e17f	role.permissions_changed	role	36dfa0ab-e22e-476a-89a3-e5d390f77d33	{"permission_keys": ["audit_trail.page.view", "branches.button.create", "branches.field.details.edit", "branches.field.hours.edit", "branches.field.status.edit", "branches.page.view", "login_history.page.view", "organization.field.branding.edit", "organization.field.contact.edit", "organization.field.hours.edit", "organization.field.identity.edit", "organization.field.locale.edit", "organization.page.view", "permissions.page.view", "permissions.role.assign_permission", "permissions.role.create", "permissions.role.delete", "permissions.role.edit", "permissions.staffoverride.edit", "staff.button.create", "staff.field.role.edit", "staff.field.status.edit", "staff.page.view", "system.config.field.business_name.edit", "system.config.field.processing_date.edit", "system.config.field.timezone.edit", "system.config.page.view", "access_policy.field.edit"]}	\N	2026-08-14 17:01:21.53568+05
b108f479-3f3c-47de-b4cc-43c16f91c57a	33b6d222-3061-41e3-b558-fa682996e17f	role.permissions_changed	role	36dfa0ab-e22e-476a-89a3-e5d390f77d33	{"permission_keys": ["access_policy.field.edit", "audit_trail.page.view", "branches.button.create", "branches.field.details.edit", "branches.field.hours.edit", "branches.field.status.edit", "branches.page.view", "login_history.page.view", "organization.field.branding.edit", "organization.field.contact.edit", "organization.field.hours.edit", "organization.field.identity.edit", "organization.field.locale.edit", "organization.page.view", "permissions.page.view", "permissions.role.assign_permission", "permissions.role.create", "permissions.role.delete", "permissions.role.edit", "permissions.staffoverride.edit", "staff.button.create", "staff.field.role.edit", "staff.field.status.edit", "staff.page.view", "system.config.field.business_name.edit", "system.config.field.processing_date.edit", "system.config.field.timezone.edit", "system.config.page.view", "access_policy.page.view"]}	\N	2026-08-14 17:01:30.570078+05
23814b69-2dc4-462a-b265-74939479d688	33b6d222-3061-41e3-b558-fa682996e17f	order.created	order	6bbd4c83-634d-4f55-bfd8-8a8c8c531afa	null	\N	2026-09-15 22:21:23.825477+05
d54fce2d-2717-427e-8575-08921d339397	33b6d222-3061-41e3-b558-fa682996e17f	order.created	order	b5dca1a1-939a-459f-a2f7-1ad485481484	null	\N	2026-09-15 22:21:24.033098+05
f5a5e2df-cd44-42b8-9c68-84cfb43c89a4	33b6d222-3061-41e3-b558-fa682996e17f	order.confirmed	order	b5dca1a1-939a-459f-a2f7-1ad485481484	null	\N	2026-09-16 09:08:05.06578+05
bbce77af-3d61-4d8c-83dc-f61fc4a81069	33b6d222-3061-41e3-b558-fa682996e17f	order.sent_to_baker	order	b5dca1a1-939a-459f-a2f7-1ad485481484	{"baker_staff_id": "d7c143c3-72a0-43ba-a3b1-5964cffa522c", "baker_name": "Ume Kalsoom"}	\N	2026-09-16 09:08:10.313834+05
1cc20007-4afc-4129-ae79-54b9f0b272d3	d7c143c3-72a0-43ba-a3b1-5964cffa522c	order.baker_accepted	order	b5dca1a1-939a-459f-a2f7-1ad485481484	null	\N	2026-09-24 22:12:31.418209+05
b999cb14-fdaf-44c9-95ad-04eb6425386e	33b6d222-3061-41e3-b558-fa682996e17f	role.permissions_changed	role	36dfa0ab-e22e-476a-89a3-e5d390f77d33	{"permission_keys": ["access_policy.page.view", "audit_trail.page.view", "branches.button.create", "branches.field.details.edit", "branches.field.hours.edit", "branches.field.status.edit", "branches.page.view", "login_history.page.view", "organization.field.branding.edit", "organization.field.contact.edit", "organization.field.hours.edit", "organization.field.identity.edit", "organization.field.locale.edit", "organization.page.view", "permissions.page.view", "permissions.role.assign_permission", "permissions.role.create", "permissions.role.delete", "permissions.role.edit", "permissions.staffoverride.edit", "staff.button.create", "staff.field.role.edit", "staff.field.status.edit", "staff.page.view", "system.config.field.business_name.edit", "system.config.field.processing_date.edit", "system.config.field.timezone.edit", "system.config.page.view"]}	\N	2026-08-14 17:01:33.65151+05
441dba79-15f0-4e8d-8d37-acc1c0015b14	33b6d222-3061-41e3-b558-fa682996e17f	role.permissions_changed	role	36dfa0ab-e22e-476a-89a3-e5d390f77d33	{"permission_keys": ["access_policy.page.view", "branches.button.create", "branches.field.details.edit", "branches.field.hours.edit", "branches.field.status.edit", "branches.page.view", "login_history.page.view", "organization.field.branding.edit", "organization.field.contact.edit", "organization.field.hours.edit", "organization.field.identity.edit", "organization.field.locale.edit", "organization.page.view", "permissions.page.view", "permissions.role.assign_permission", "permissions.role.create", "permissions.role.delete", "permissions.role.edit", "permissions.staffoverride.edit", "staff.button.create", "staff.field.role.edit", "staff.field.status.edit", "staff.page.view", "system.config.field.business_name.edit", "system.config.field.processing_date.edit", "system.config.field.timezone.edit", "system.config.page.view", "access_policy.field.edit"]}	\N	2026-08-14 17:02:21.429511+05
a6720e82-73d4-4bdd-86f0-b73fedfac339	33b6d222-3061-41e3-b558-fa682996e17f	role.permissions_changed	role	36dfa0ab-e22e-476a-89a3-e5d390f77d33	{"permission_keys": ["access_policy.field.edit", "access_policy.page.view", "branches.button.create", "branches.field.details.edit", "branches.field.hours.edit", "branches.field.status.edit", "branches.page.view", "login_history.page.view", "organization.field.branding.edit", "organization.field.contact.edit", "organization.field.hours.edit", "organization.field.identity.edit", "organization.field.locale.edit", "organization.page.view", "permissions.page.view", "permissions.role.assign_permission", "permissions.role.create", "permissions.role.delete", "permissions.role.edit", "permissions.staffoverride.edit", "staff.button.create", "staff.field.role.edit", "staff.field.status.edit", "staff.page.view", "system.config.field.business_name.edit", "system.config.field.processing_date.edit", "system.config.field.timezone.edit", "system.config.page.view", "audit_trail.page.view"]}	\N	2026-08-14 17:02:34.552901+05
63d752b0-c854-4f47-9dc0-d04f26590761	33b6d222-3061-41e3-b558-fa682996e17f	role.permissions_changed	role	36dfa0ab-e22e-476a-89a3-e5d390f77d33	{"permission_keys": ["access_policy.page.view", "branches.button.create", "branches.field.details.edit", "branches.field.hours.edit", "branches.field.status.edit", "branches.page.view", "login_history.page.view", "organization.field.branding.edit", "organization.field.contact.edit", "organization.field.hours.edit", "organization.field.identity.edit", "organization.field.locale.edit", "organization.page.view", "permissions.page.view", "permissions.role.assign_permission", "permissions.role.create", "permissions.role.delete", "permissions.role.edit", "permissions.staffoverride.edit", "staff.button.create", "staff.field.role.edit", "staff.field.status.edit", "staff.page.view", "system.config.field.business_name.edit", "system.config.field.processing_date.edit", "system.config.field.timezone.edit", "system.config.page.view"]}	\N	2026-08-14 17:02:09.060391+05
1d18e1af-959e-4dc2-bcbf-e794ef05f1c8	33b6d222-3061-41e3-b558-fa682996e17f	role.permissions_changed	role	377880a9-5e4c-48ff-9e4d-44f132caf6ed	{"permission_keys": ["access_policy.field.edit", "access_policy.page.view"]}	\N	2026-08-15 14:16:22.157105+05
1153b970-b9e2-4bfc-a5b8-b00d5b6ba542	33b6d222-3061-41e3-b558-fa682996e17f	staff.created	staff	bb7f0a40-2b83-41d5-b2cc-873db2434876	null	\N	2026-08-16 16:26:57.054093+05
6d50f5b6-4024-4178-a456-372dfbd02552	33b6d222-3061-41e3-b558-fa682996e17f	order.created	order	1a909349-0c6c-4dac-84fe-ce1d1c405861	null	\N	2026-08-21 15:31:21.911527+05
a9633055-da3d-4e6c-bfc6-53f010e95e11	33b6d222-3061-41e3-b558-fa682996e17f	order.confirmed	order	1a909349-0c6c-4dac-84fe-ce1d1c405861	null	\N	2026-08-21 15:31:40.143024+05
be2b34e7-be29-4040-90b8-4147979834b9	33b6d222-3061-41e3-b558-fa682996e17f	order.sent_to_baker	order	1a909349-0c6c-4dac-84fe-ce1d1c405861	null	\N	2026-08-21 15:31:59.216338+05
21fb0478-f4e3-4aac-9f59-49dc1138d41d	33b6d222-3061-41e3-b558-fa682996e17f	role.permissions_changed	role	644cb2d7-3dd9-447e-a234-081c2c19d0cf	{"permission_keys": ["orders.page.view"]}	\N	2026-08-21 15:32:59.705527+05
5dad8174-8f9b-44a5-8495-f2dfb19495ec	33b6d222-3061-41e3-b558-fa682996e17f	order.created	order	71606ac0-133e-4625-88a8-2cfa7a537bb3	null	\N	2026-08-24 09:11:35.436136+05
070904ed-246c-491a-8485-99ba9eba377a	33b6d222-3061-41e3-b558-fa682996e17f	cake_size.updated	cake_size	9468ff63-c5fb-4cff-99b6-700ebc2bac12	null	\N	2026-08-24 09:24:08.513234+05
8f31b003-83a1-4108-9521-2633b41e70a9	33b6d222-3061-41e3-b558-fa682996e17f	cake_size.updated	cake_size	9468ff63-c5fb-4cff-99b6-700ebc2bac12	null	\N	2026-08-24 09:24:54.335115+05
137409a9-8c2e-4c23-889b-b2a35ff1e17f	33b6d222-3061-41e3-b558-fa682996e17f	cake_size.updated	cake_size	b0da58df-10e4-475a-a9ca-56ceb106f17f	null	\N	2026-08-24 09:25:15.65834+05
7fdf235b-550a-4587-a801-234d152d718f	33b6d222-3061-41e3-b558-fa682996e17f	cake_size.updated	cake_size	9468ff63-c5fb-4cff-99b6-700ebc2bac12	null	\N	2026-08-24 09:25:20.618457+05
d01fae61-488a-454e-b596-8e9b72e36479	33b6d222-3061-41e3-b558-fa682996e17f	cake_size.updated	cake_size	b3373689-b86c-49c5-91fd-0b19e61d9083	null	\N	2026-08-24 09:25:45.795641+05
08edf087-9cc1-4363-93ed-3309837c21be	33b6d222-3061-41e3-b558-fa682996e17f	cake_size.updated	cake_size	43212069-414e-4743-a664-0d93ab872aaa	null	\N	2026-08-24 09:26:04.48088+05
660133f6-5b8b-4f40-be1a-252cb153cb04	33b6d222-3061-41e3-b558-fa682996e17f	cake_tier.created	cake_tier	3fbcf0ba-1067-48ee-a3bd-000fd26940b8	null	\N	2026-08-24 09:27:46.621707+05
6b62ba89-4000-46ef-865a-526e360cd63d	33b6d222-3061-41e3-b558-fa682996e17f	cake_tier.created	cake_tier	6b6cbc2c-770e-4da1-a1cc-8b250cd50ac7	null	\N	2026-08-24 09:28:18.475074+05
067858e4-36d9-4873-b16c-9e7dbc6c6d73	33b6d222-3061-41e3-b558-fa682996e17f	cake_tier.created	cake_tier	03093d85-4ea3-4aee-9fe1-0c0ae3db40cb	null	\N	2026-08-24 09:28:45.81672+05
6d9e0312-36b4-4071-8caa-da6f82155b17	33b6d222-3061-41e3-b558-fa682996e17f	cake_tier.created	cake_tier	89941432-415a-46f9-94e5-b7f7b6eea95f	null	\N	2026-08-24 09:29:08.609937+05
8cd8541d-134d-4986-b5b3-e37753452fcd	33b6d222-3061-41e3-b558-fa682996e17f	cake_tier.created	cake_tier	42cdf987-aa53-443e-9ead-66b01ef73167	null	\N	2026-08-24 09:29:34.394824+05
0bb7e0a6-d161-472e-8f1e-a73ec21e51bb	33b6d222-3061-41e3-b558-fa682996e17f	cake_tier.created	cake_tier	eb391ee2-9c02-4d76-974b-964635e48386	null	\N	2026-08-24 09:29:59.495977+05
8a00f8fb-c7ee-4ae9-9d6e-b77f32a9229d	33b6d222-3061-41e3-b558-fa682996e17f	cake_tier.created	cake_tier	3f96939c-1e28-40b1-8cd0-1312e72cf549	null	\N	2026-08-24 09:30:19.070296+05
8cb6add5-2803-43be-aa86-1948e6027e3d	33b6d222-3061-41e3-b558-fa682996e17f	cake_tier.updated	cake_tier	3f96939c-1e28-40b1-8cd0-1312e72cf549	null	\N	2026-08-24 09:30:25.925989+05
e7ac8fa7-51b7-468b-aa84-f1d420f8eb5e	33b6d222-3061-41e3-b558-fa682996e17f	role.permissions_changed	role	cfa36ef0-652c-47e0-9dbe-b07bcd899dae	{"permission_keys": ["staff.page.view", "orders.button.confirm", "orders.button.create", "orders.button.send_to_baker", "orders.field.edit", "orders.page.view", "orders.button.cancel"]}	\N	2026-08-24 09:42:20.053551+05
534f8fa9-971a-4e56-b75b-17a432f3aca5	33b6d222-3061-41e3-b558-fa682996e17f	order.updated	order	71606ac0-133e-4625-88a8-2cfa7a537bb3	null	\N	2026-08-24 14:24:48.855974+05
3057304d-c96e-4d0c-9c4e-44b4ecb0a740	33b6d222-3061-41e3-b558-fa682996e17f	order.updated	order	71606ac0-133e-4625-88a8-2cfa7a537bb3	null	\N	2026-08-24 14:25:11.844925+05
ef09c7bb-59bc-48bf-81d2-401b163bed55	33b6d222-3061-41e3-b558-fa682996e17f	order.created	order	f20448ae-34e6-4858-b714-ecef1bf6f35d	null	\N	2026-08-24 14:26:30.273166+05
38a25c57-14df-4cf8-b473-8689f9dfc32d	33b6d222-3061-41e3-b558-fa682996e17f	order.updated	order	f20448ae-34e6-4858-b714-ecef1bf6f35d	null	\N	2026-08-25 09:18:09.94561+05
5922387c-3637-4897-a01c-853aeacb84e9	33b6d222-3061-41e3-b558-fa682996e17f	order.updated	order	f20448ae-34e6-4858-b714-ecef1bf6f35d	null	\N	2026-08-25 09:18:52.857016+05
7f7ce8a5-7600-4667-bcd5-481204a4b98b	33b6d222-3061-41e3-b558-fa682996e17f	order.updated	order	f20448ae-34e6-4858-b714-ecef1bf6f35d	null	\N	2026-08-25 14:38:02.109222+05
c770d822-a04e-4d54-b3a4-e3870de1f099	33b6d222-3061-41e3-b558-fa682996e17f	order.confirmed	order	f20448ae-34e6-4858-b714-ecef1bf6f35d	null	\N	2026-08-26 23:48:36.574004+05
1fb3578c-f8ab-4fd7-b60e-cbe6b6026fe0	33b6d222-3061-41e3-b558-fa682996e17f	order.sent_to_baker	order	f20448ae-34e6-4858-b714-ecef1bf6f35d	{"baker_staff_id": "bb7f0a40-2b83-41d5-b2cc-873db2434876", "baker_name": "Rawaidah Nadeem"}	\N	2026-08-26 23:48:52.612912+05
e5f17649-eac2-4034-afdf-29363b061550	33b6d222-3061-41e3-b558-fa682996e17f	delivery_zone.created	delivery_zone	938ecaa9-bd95-48b2-9eca-c2afc915f0e3	null	\N	2026-08-26 23:52:39.900787+05
1f2cac6c-bb9c-462e-8b05-b24e2e821213	33b6d222-3061-41e3-b558-fa682996e17f	delivery_zone.created	delivery_zone	4f2b1dda-7988-4baa-a19c-9ae6eeb14338	null	\N	2026-08-26 23:53:07.788357+05
b0d8b465-f7aa-4059-aa1d-cbfbced870f4	33b6d222-3061-41e3-b558-fa682996e17f	inventory_item.created	inventory_item	0821fce9-e97b-4e68-8e66-5cac861559b3	null	\N	2026-09-02 08:43:02.383292+05
7b4564cd-2e1f-4a3b-9983-8c7efecd9ba7	33b6d222-3061-41e3-b558-fa682996e17f	inventory_item.stock_adjusted	inventory_item	0821fce9-e97b-4e68-8e66-5cac861559b3	{"qty_delta": 1.0, "reason": "purchase", "notes": null}	\N	2026-09-02 08:43:21.108023+05
633bfa9e-70b7-4c9a-abc4-02718933bbe0	33b6d222-3061-41e3-b558-fa682996e17f	inventory_item.created	inventory_item	14a45978-ec89-4a60-8584-c1b9d4452e79	null	\N	2026-09-02 08:44:11.275108+05
497d49ba-88da-4e54-a4bc-072e2a7bcc2e	33b6d222-3061-41e3-b558-fa682996e17f	inventory_item.stock_adjusted	inventory_item	14a45978-ec89-4a60-8584-c1b9d4452e79	{"qty_delta": 1.0, "reason": "purchase", "notes": null}	\N	2026-09-02 08:44:17.604218+05
52164c8f-43de-4f9a-83c4-e56d11ce6f17	33b6d222-3061-41e3-b558-fa682996e17f	inventory_item.created	inventory_item	570fd9be-40de-42f6-abc1-0c4002fed708	null	\N	2026-09-02 08:44:58.987485+05
fab07d55-a8a3-40fd-9019-ac8283800473	33b6d222-3061-41e3-b558-fa682996e17f	inventory_item.stock_adjusted	inventory_item	570fd9be-40de-42f6-abc1-0c4002fed708	{"qty_delta": 1.0, "reason": "purchase", "notes": null}	\N	2026-09-02 08:45:04.254489+05
a04c0164-91a6-43cc-8bb4-deb7a0ac9b53	33b6d222-3061-41e3-b558-fa682996e17f	inventory_item.created	inventory_item	9e942ce8-11c8-463b-af4c-446bda460af0	null	\N	2026-09-02 08:45:40.858134+05
345a8882-5068-4cce-b312-3a82cdb0a96f	33b6d222-3061-41e3-b558-fa682996e17f	inventory_item.stock_adjusted	inventory_item	9e942ce8-11c8-463b-af4c-446bda460af0	{"qty_delta": 100.0, "reason": "purchase", "notes": null}	\N	2026-09-02 08:45:49.140836+05
897a5130-d32e-4098-9ef0-dc873b3d855d	33b6d222-3061-41e3-b558-fa682996e17f	inventory_item.created	inventory_item	384a4321-a2e1-4146-8798-a0b4ff95e208	null	\N	2026-09-02 08:46:56.719405+05
bc359014-7e04-4244-a3c9-f5fcfd2608df	33b6d222-3061-41e3-b558-fa682996e17f	inventory_item.stock_adjusted	inventory_item	384a4321-a2e1-4146-8798-a0b4ff95e208	{"qty_delta": 12.0, "reason": "purchase", "notes": null}	\N	2026-09-02 08:47:02.841037+05
7930e915-477e-4792-8bb8-49158d5370d8	33b6d222-3061-41e3-b558-fa682996e17f	staff.created	staff	d7c143c3-72a0-43ba-a3b1-5964cffa522c	null	\N	2026-09-15 22:19:06.426187+05
a7e89220-aa09-43cb-88aa-ed5cfeefa47b	33b6d222-3061-41e3-b558-fa682996e17f	order.created	order	3541cea9-0c06-43ec-b58d-c0895129377a	null	\N	2026-09-15 22:21:10.346381+05
0aa759b5-ed8c-4880-bac4-7344d3473924	33b6d222-3061-41e3-b558-fa682996e17f	order.created	order	f13ee643-cf20-47cf-80a9-f2dbc233efe6	null	\N	2026-09-15 22:21:23.005644+05
4ef139de-b3e2-4bca-b98d-78a3280d436f	33b6d222-3061-41e3-b558-fa682996e17f	order.created	order	23d73888-dc87-4f8d-b535-ed2ac0115b8a	null	\N	2026-09-15 22:21:23.617963+05
ae712094-fa96-4711-864f-71e9bbe718ba	33b6d222-3061-41e3-b558-fa682996e17f	unit.created	unit	8779792c-d8a8-43ff-9001-a8a322a755b1	null	\N	2026-09-24 22:21:22.818742+05
c76b331f-cd29-4356-81f9-36ba2fe28383	33b6d222-3061-41e3-b558-fa682996e17f	unit.created	unit	7cd56a67-9f36-4157-b35d-f2e48b08affd	null	\N	2026-09-24 22:21:40.434062+05
fb5ac682-62b3-44d8-8abb-1d3a73eabebd	33b6d222-3061-41e3-b558-fa682996e17f	unit.created	unit	462b3a59-6b6b-43e2-b26d-01e107553b74	null	\N	2026-09-24 22:21:53.499417+05
1d3c30ca-caaa-4600-b0ad-205ecfef169f	33b6d222-3061-41e3-b558-fa682996e17f	unit.created	unit	d5205235-e515-4988-812e-f3c8d8b09aec	null	\N	2026-09-24 22:22:06.728528+05
4e9de4ca-aca2-481e-8274-40f5683ea9cf	33b6d222-3061-41e3-b558-fa682996e17f	inventory_item.updated	inventory_item	0821fce9-e97b-4e68-8e66-5cac861559b3	null	\N	2026-09-24 22:22:27.818708+05
5eb8a79f-e575-4ed2-9d0c-337b1497e2f3	33b6d222-3061-41e3-b558-fa682996e17f	inventory_item.stock_adjusted	inventory_item	0821fce9-e97b-4e68-8e66-5cac861559b3	{"qty_delta": 12.0, "reason": "adjustment", "notes": null}	\N	2026-09-24 22:22:37.005482+05
95b3be0a-8b36-48c5-91d0-b6f47d2570c3	d7c143c3-72a0-43ba-a3b1-5964cffa522c	order.production_started	order	b5dca1a1-939a-459f-a2f7-1ad485481484	null	\N	2026-09-24 22:24:38.00626+05
73104c4d-084f-4e88-8b2a-03f8668368c3	d7c143c3-72a0-43ba-a3b1-5964cffa522c	order.marked_ready	order	b5dca1a1-939a-459f-a2f7-1ad485481484	null	\N	2026-09-24 22:24:57.257559+05
2e2e99e7-547e-4985-8b04-81c20afb7e15	33b6d222-3061-41e3-b558-fa682996e17f	order.handover_completed	order	b5dca1a1-939a-459f-a2f7-1ad485481484	{"amount_received": 1500.0}	\N	2026-09-24 22:27:03.668377+05
ca5ca38e-63c2-454a-aa48-44325b8f5f10	33b6d222-3061-41e3-b558-fa682996e17f	order.updated	order	6bbd4c83-634d-4f55-bfd8-8a8c8c531afa	null	\N	2026-09-24 22:28:01.727459+05
8c04aa05-cbcb-4935-8dc0-7d1e73cc212c	33b6d222-3061-41e3-b558-fa682996e17f	order.confirmed	order	6bbd4c83-634d-4f55-bfd8-8a8c8c531afa	null	\N	2026-09-24 22:28:11.154428+05
a015ee3b-79e4-4568-aa38-0be9c167f265	33b6d222-3061-41e3-b558-fa682996e17f	order.sent_to_baker	order	6bbd4c83-634d-4f55-bfd8-8a8c8c531afa	{"baker_staff_id": "d7c143c3-72a0-43ba-a3b1-5964cffa522c", "baker_name": "Ume Kalsoom"}	\N	2026-09-24 22:28:15.262695+05
83406620-4dbb-448b-8603-d9e4daf07128	d7c143c3-72a0-43ba-a3b1-5964cffa522c	order.baker_accepted	order	6bbd4c83-634d-4f55-bfd8-8a8c8c531afa	null	\N	2026-09-24 22:28:29.577193+05
f240061b-3abb-4e60-bf60-6e2c9f3c9604	d7c143c3-72a0-43ba-a3b1-5964cffa522c	order.production_started	order	6bbd4c83-634d-4f55-bfd8-8a8c8c531afa	null	\N	2026-09-24 22:28:59.215726+05
21bdceac-21bb-4a49-86e6-686b6a3eeb59	d7c143c3-72a0-43ba-a3b1-5964cffa522c	order.marked_ready	order	6bbd4c83-634d-4f55-bfd8-8a8c8c531afa	null	\N	2026-09-24 22:29:01.706829+05
4951d3cd-0671-4467-a06b-ea689a132a92	33b6d222-3061-41e3-b558-fa682996e17f	order.rider_assigned	order	6bbd4c83-634d-4f55-bfd8-8a8c8c531afa	{"rider_staff_id": "ab242ada-05ef-4ed4-94bf-b300bc8c05dd", "rider_name": "Ayyan"}	\N	2026-09-24 22:29:15.70233+05
7a2687c7-389c-4f62-bf4f-a208c6ea869a	ab242ada-05ef-4ed4-94bf-b300bc8c05dd	order.delivered	order	6bbd4c83-634d-4f55-bfd8-8a8c8c531afa	{"amount_collected": 1750.0}	\N	2026-09-24 22:54:00.62009+05
5c8f9d5d-8d6e-4e3a-84e6-90bcbfc540e4	33b6d222-3061-41e3-b558-fa682996e17f	order.handover_completed	order	6bbd4c83-634d-4f55-bfd8-8a8c8c531afa	{"amount_received": 1750.0}	\N	2026-09-24 22:54:30.061155+05
c46e9267-a9aa-4eca-b0b1-5d5d291b21ad	33b6d222-3061-41e3-b558-fa682996e17f	inventory_item.stock_adjusted	inventory_item	14a45978-ec89-4a60-8584-c1b9d4452e79	{"qty_delta": -1.0, "reason": "wastage", "notes": null}	\N	2026-09-24 22:55:09.550107+05
48105501-2f5d-46aa-a740-4aab96090796	33b6d222-3061-41e3-b558-fa682996e17f	inventory_item.stock_adjusted	inventory_item	14a45978-ec89-4a60-8584-c1b9d4452e79	{"qty_delta": -1.0, "reason": "wastage", "notes": null}	\N	2026-09-24 22:55:43.279166+05
af98ee0e-d1c7-425e-a606-49c89535aa6d	33b6d222-3061-41e3-b558-fa682996e17f	supplier.created	supplier	17fcdab4-09da-4a3f-926c-68d362ccd18f	null	\N	2026-09-25 17:09:05.640595+05
b693e211-c119-4e0c-bcdd-b8439c1aa2bb	33b6d222-3061-41e3-b558-fa682996e17f	purchase.recorded	purchase	5a0db3fc-586a-4b5a-940e-e25a99a61d61	{"total_amount": 600.0, "item_count": 1}	\N	2026-09-25 17:09:57.161028+05
58bab954-59dd-4ca8-a859-d13cb4aca285	33b6d222-3061-41e3-b558-fa682996e17f	order.confirmed	order	23d73888-dc87-4f8d-b535-ed2ac0115b8a	null	\N	2026-09-25 17:12:18.631677+05
21e4f726-0f6c-4d4d-95f7-7e57589bacfd	33b6d222-3061-41e3-b558-fa682996e17f	order.sent_to_baker	order	23d73888-dc87-4f8d-b535-ed2ac0115b8a	{"baker_staff_id": "d7c143c3-72a0-43ba-a3b1-5964cffa522c", "baker_name": "Ume Kalsoom"}	\N	2026-09-25 17:12:23.142327+05
706c58a5-5ba3-4e7c-a159-4ada6d873a09	d7c143c3-72a0-43ba-a3b1-5964cffa522c	order.baker_declined	order	23d73888-dc87-4f8d-b535-ed2ac0115b8a	{"reason": "I am not available today, please give this order to other baker."}	\N	2026-09-25 17:13:09.812192+05
022e2246-cfec-4ff8-97c7-4aa84e56f17c	33b6d222-3061-41e3-b558-fa682996e17f	order.sent_to_baker	order	23d73888-dc87-4f8d-b535-ed2ac0115b8a	{"baker_staff_id": "bb7f0a40-2b83-41d5-b2cc-873db2434876", "baker_name": "Rawaidah Nadeem"}	\N	2026-09-25 17:13:28.010737+05
ceff6d88-cef8-427e-a0fb-75c3648e3b36	bb7f0a40-2b83-41d5-b2cc-873db2434876	order.baker_accepted	order	23d73888-dc87-4f8d-b535-ed2ac0115b8a	null	\N	2026-09-25 17:13:54.180405+05
ab3037dd-6021-4d13-a6d9-abc161de3c64	33b6d222-3061-41e3-b558-fa682996e17f	unit.created	unit	76d70012-e8f2-4a51-b753-0a67367b9226	null	\N	2026-09-25 17:32:32.968236+05
e044d7f2-44be-4ef2-aa05-1a2f4b50c03c	33b6d222-3061-41e3-b558-fa682996e17f	purchase.recorded	purchase	2b085bc5-884e-4b3a-99e1-8e191f5e6bf0	{"total_amount": 360.0, "item_count": 1}	\N	2026-09-25 17:33:39.503868+05
dd1db6fa-5c23-4685-9972-70775c836935	33b6d222-3061-41e3-b558-fa682996e17f	purchase.recorded	purchase	c00437dc-fafb-4a74-afec-277c7339a38a	{"total_amount": 125.0, "item_count": 1}	\N	2026-09-25 17:34:05.136512+05
d5e892ea-24ba-428f-bc69-bbeaa7cfeb02	33b6d222-3061-41e3-b558-fa682996e17f	purchase.recorded	purchase	c07ede53-4ad2-467b-81a7-53b73efa12d2	{"total_amount": 400.0, "item_count": 1}	\N	2026-09-25 17:39:42.576334+05
f6991138-faac-4491-96ea-65225a7a89e3	33b6d222-3061-41e3-b558-fa682996e17f	inventory_item.stock_adjusted	inventory_item	14a45978-ec89-4a60-8584-c1b9d4452e79	{"qty_delta": 1.0, "reason": "adjustment", "notes": null}	\N	2026-09-25 22:35:59.153651+05
30449fb7-7b05-424e-8ee3-2d19577bc62a	33b6d222-3061-41e3-b558-fa682996e17f	inventory_item.stock_adjusted	inventory_item	14a45978-ec89-4a60-8584-c1b9d4452e79	{"qty_delta": -80.0, "reason": "wastage", "notes": null}	\N	2026-09-25 22:36:10.667048+05
dc3d2d34-ec82-453b-9bdc-043ea6c3cce8	33b6d222-3061-41e3-b558-fa682996e17f	inventory_item.stock_adjusted	inventory_item	14a45978-ec89-4a60-8584-c1b9d4452e79	{"qty_delta": 160.0, "reason": "adjustment", "notes": null}	\N	2026-09-25 22:36:24.667524+05
fef2d55c-2d0e-4ba0-b72c-09d7c2b43b32	33b6d222-3061-41e3-b558-fa682996e17f	inventory_item.stock_adjusted	inventory_item	14a45978-ec89-4a60-8584-c1b9d4452e79	{"qty_delta": 1.0, "reason": "adjustment", "notes": null}	\N	2026-09-25 22:36:53.854539+05
ac788e1f-b54d-4e4f-88fe-0abaee0370dd	bb7f0a40-2b83-41d5-b2cc-873db2434876	order.baker_accepted	order	f20448ae-34e6-4858-b714-ecef1bf6f35d	null	\N	2026-09-25 22:50:58.735145+05
806bcaf0-33ea-47ed-b769-3d2f74e84269	33b6d222-3061-41e3-b558-fa682996e17f	supplier.created	supplier	aa9027e5-90c9-4b89-a4db-dfecd8d793fc	null	\N	2026-09-26 09:34:20.253363+05
3aec932a-0b25-42a1-b837-e394f5707ad8	33b6d222-3061-41e3-b558-fa682996e17f	purchase.recorded	purchase	cd931a76-2ead-4f5e-ab92-1e1408991a87	{"total_amount": 1700.0, "item_count": 1}	\N	2026-09-26 09:34:53.400448+05
a002be33-7ee8-485e-b782-897da2b81108	33b6d222-3061-41e3-b558-fa682996e17f	order.created	order	b41ada32-9462-4c18-96cd-5fa81f53dd54	null	\N	2026-09-26 09:54:27.049604+05
36ea7c6f-00a3-4505-869d-6a7b99fc4a69	33b6d222-3061-41e3-b558-fa682996e17f	order.confirmed	order	b41ada32-9462-4c18-96cd-5fa81f53dd54	null	\N	2026-09-26 09:56:30.505541+05
70dceb56-07ce-4b25-9e43-0751a0dd5404	33b6d222-3061-41e3-b558-fa682996e17f	order.sent_to_baker	order	b41ada32-9462-4c18-96cd-5fa81f53dd54	{"baker_staff_id": "d7c143c3-72a0-43ba-a3b1-5964cffa522c", "baker_name": "Ume Kalsoom"}	\N	2026-09-26 09:57:14.209452+05
7a6c7c28-2d6e-4fc9-9bee-0ccbabd3f290	d7c143c3-72a0-43ba-a3b1-5964cffa522c	order.baker_accepted	order	b41ada32-9462-4c18-96cd-5fa81f53dd54	null	\N	2026-09-26 09:57:41.947694+05
c036179f-4dcd-432f-b22c-33ce18e1858a	d7c143c3-72a0-43ba-a3b1-5964cffa522c	order.production_started	order	b41ada32-9462-4c18-96cd-5fa81f53dd54	null	\N	2026-09-26 09:58:06.500914+05
e2b897e8-5647-44c7-918d-e7fb510d4b29	d7c143c3-72a0-43ba-a3b1-5964cffa522c	order.marked_ready	order	b41ada32-9462-4c18-96cd-5fa81f53dd54	null	\N	2026-09-26 09:58:18.510811+05
3dde5c89-b67d-4653-9830-21432260aebf	33b6d222-3061-41e3-b558-fa682996e17f	order.handover_completed	order	b41ada32-9462-4c18-96cd-5fa81f53dd54	{"amount_received": 1500.0}	\N	2026-09-26 10:09:22.867577+05
d519ef6e-0e14-48b6-a1a0-36be31585021	33b6d222-3061-41e3-b558-fa682996e17f	system.date_mode_changed	system	1	{"date_mode": "system"}	\N	2026-09-26 15:20:39.374518+05
441c33f9-4e75-48d5-96cc-047ad6343946	33b6d222-3061-41e3-b558-fa682996e17f	system.date_mode_changed	system	1	{"date_mode": "processing"}	\N	2026-09-26 15:20:42.030616+05
4091274c-25f3-4a3d-bd61-d22f247a4cb1	33b6d222-3061-41e3-b558-fa682996e17f	system.date_mode_changed	system	1	{"date_mode": "system"}	\N	2026-09-26 15:20:45.573936+05
\.


--
-- Data for Name: branch; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.branch (id, name, code, address_line1, address_line2, city, state, country, postal_code, phone, email, manager_staff_id, business_hours, timezone, currency, is_active, is_default, created_at) FROM stdin;
05267d89-49af-4e91-941f-befa8de8b305	Main branch	MAIN	59 Railway road	Asmat Street	Renala Khurd	Punjad	Pakistan	56130	03424943054	khizarqadri92@gmail.com	33b6d222-3061-41e3-b558-fa682996e17f	{"mon": {"open": "09:00", "close": "22:00", "closed": false}, "tue": {"open": "09:00", "close": "22:00", "closed": false}, "wed": {"open": "09:00", "close": "22:00", "closed": false}, "thu": {"open": "09:00", "close": "22:00", "closed": false}, "fri": {"open": "09:00", "close": "22:00", "closed": false}, "sat": {"open": "09:00", "close": "22:00", "closed": false}, "sun": {"open": "09:00", "close": "22:00", "closed": false}}	Asia/Karachi	PKR	t	t	2026-08-12 11:02:16.730859+05
\.


--
-- Data for Name: branchfieldaccess; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.branchfieldaccess (id, role_id, branch_id, section_key, field_key, access_level) FROM stdin;
c56c7336-6cdb-40d2-9fc5-80758bd16945	36dfa0ab-e22e-476a-89a3-e5d390f77d33	05267d89-49af-4e91-941f-befa8de8b305	main	_section_	ENABLE
8f7cd726-99c7-4c36-ac9c-151dcd95e3f3	36dfa0ab-e22e-476a-89a3-e5d390f77d33	05267d89-49af-4e91-941f-befa8de8b305	contact	address_line1	ENABLE
e5a14027-d091-4a35-a124-6c3fec7e9620	36dfa0ab-e22e-476a-89a3-e5d390f77d33	05267d89-49af-4e91-941f-befa8de8b305	contact	address_line2	ENABLE
8e46eac0-2aa0-4e01-82c3-1c9c291d8bf8	36dfa0ab-e22e-476a-89a3-e5d390f77d33	05267d89-49af-4e91-941f-befa8de8b305	contact	city	ENABLE
14f93fed-05e4-4c18-991d-a441d09ef402	36dfa0ab-e22e-476a-89a3-e5d390f77d33	05267d89-49af-4e91-941f-befa8de8b305	contact	state	ENABLE
1fba06af-8bc9-44f2-bb23-cbd2dc66c372	36dfa0ab-e22e-476a-89a3-e5d390f77d33	05267d89-49af-4e91-941f-befa8de8b305	contact	country	ENABLE
ec9621f9-f0a6-4e4d-8d16-e36869240557	36dfa0ab-e22e-476a-89a3-e5d390f77d33	05267d89-49af-4e91-941f-befa8de8b305	contact	postal_code	ENABLE
634b62e7-31f2-4f1a-b05f-9eed9637c29a	36dfa0ab-e22e-476a-89a3-e5d390f77d33	05267d89-49af-4e91-941f-befa8de8b305	contact	phone	ENABLE
7d3253cd-01b0-4791-be10-4ea74fdc44b0	36dfa0ab-e22e-476a-89a3-e5d390f77d33	05267d89-49af-4e91-941f-befa8de8b305	contact	email	ENABLE
145cf01a-8e7f-4362-a5a7-ea5047352f1c	36dfa0ab-e22e-476a-89a3-e5d390f77d33	05267d89-49af-4e91-941f-befa8de8b305	contact	manager_staff_id	ENABLE
c6bfb639-abc2-44c5-a989-9f7f61fe7cb7	36dfa0ab-e22e-476a-89a3-e5d390f77d33	05267d89-49af-4e91-941f-befa8de8b305	hours	business_hours	ENABLE
719c4b1b-0c9a-4cbc-bf5b-c6dcf58668f3	36dfa0ab-e22e-476a-89a3-e5d390f77d33	05267d89-49af-4e91-941f-befa8de8b305	hours	timezone	ENABLE
01febada-ab6e-48ad-91eb-89d0bac236a3	36dfa0ab-e22e-476a-89a3-e5d390f77d33	05267d89-49af-4e91-941f-befa8de8b305	hours	currency	ENABLE
d1934969-ac0c-42f2-906d-35e7b06f86ec	36dfa0ab-e22e-476a-89a3-e5d390f77d33	05267d89-49af-4e91-941f-befa8de8b305	status	is_active	ENABLE
665f4185-9908-4f70-a3b6-da2b2e12dc1c	36dfa0ab-e22e-476a-89a3-e5d390f77d33	05267d89-49af-4e91-941f-befa8de8b305	status	is_default	ENABLE
\.


--
-- Data for Name: cakeaddon; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.cakeaddon (id, name, description, price, max_qty, image_url, is_active, sort_order) FROM stdin;
cc45cf67-c462-4246-81fd-06d1028eac3f	Fondant Topper	Custom fondant topper	500	1	\N	t	0
e8b2ea60-df47-4f87-aaa1-2a9ca75f7e12	Edible Flowers	Edible sugar flowers	300	5	\N	t	1
c84dbb66-e437-411a-afa5-97ad527a0273	Sprinkles	Colorful sprinkle mix	100	1	\N	t	2
16654c96-5699-436e-bf8e-0c274f90e142	Personalized Message	Custom message in icing	150	1	\N	t	3
\.


--
-- Data for Name: cakebox; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.cakebox (id, name, description, price_modifier, image_url, is_active, sort_order) FROM stdin;
\.


--
-- Data for Name: cakecolor; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.cakecolor (id, name, description, price_modifier, image_url, is_active, sort_order) FROM stdin;
\.


--
-- Data for Name: cakefilling; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.cakefilling (id, name, description, price_modifier, image_url, is_active, sort_order) FROM stdin;
dd33c27d-b590-4f05-823e-ba6fa6227f16	Buttercream	Classic vanilla buttercream	0	\N	t	0
00c221eb-9b00-45dc-af0b-34c64cc1104d	Fresh Cream	Light whipped cream	0	\N	t	1
59982c6f-2c02-43e1-9f87-14b711f3ac10	Chocolate Ganache	Rich dark chocolate ganache	250	\N	t	2
f47001ab-3a46-4381-8d6b-8e6c1951f62c	Fruit Compote	Mixed berry compote	300	\N	t	3
\.


--
-- Data for Name: cakeflavor; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.cakeflavor (id, name, description, price_modifier, image_url, is_active, sort_order) FROM stdin;
89e9671e-a4a8-4612-8b5c-8dd0ad9aebd0	Vanilla	Classic vanilla sponge	0	\N	t	0
3bb8e894-fccd-4afc-97b1-53070068db78	Chocolate	Rich cocoa sponge	0	\N	t	1
661ca71a-1bac-4a7a-9342-78f0f7c1b4ab	Red Velvet	Cocoa sponge with a hint of buttermilk tang	300	\N	t	2
b6a8cf91-33de-437a-8cec-b6fbf5fb6058	Lemon	Light sponge with fresh lemon zest	200	\N	t	3
\.


--
-- Data for Name: cakefrosting; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.cakefrosting (id, name, description, price_modifier, image_url, is_active, sort_order) FROM stdin;
8dcadf37-e25d-442f-87f2-5dbea67440b4	Buttercream	Smooth classic buttercream finish	0	\N	t	0
4cc71a2b-fb1a-410a-a64f-1fac3accc518	Fondant	Smooth rolled fondant finish	500	\N	t	1
62644508-ad6c-4a16-a433-591fd470f460	Whipped Cream	Light whipped cream finish	0	\N	t	2
c02c7de1-09aa-4472-81f6-f44047488f80	Ganache	Glossy chocolate ganache finish	300	\N	t	3
\.


--
-- Data for Name: cakeshape; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.cakeshape (id, name, description, price_modifier, image_url, is_active, sort_order) FROM stdin;
b4e05194-d169-48a8-991b-e5477e2f4efc	Round	Classic round cake	0	\N	t	0
7497c449-f108-49ee-82c2-63781d29fb70	Square	Classic square cake	0	\N	t	1
eaef87ef-c6f9-410b-800e-b272ac66ff2a	Heart	Heart-shaped cake	400	\N	t	2
55f9af85-57f8-48a5-a569-9f91c7cf473f	Number	Number-shaped cake	800	\N	t	3
\.


--
-- Data for Name: cakesize; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.cakesize (id, name, servings, price_modifier, is_active, sort_order) FROM stdin;
b0da58df-10e4-475a-a9ca-56ceb106f17f	2 pounds	12	1500	t	1
9468ff63-c5fb-4cff-99b6-700ebc2bac12	1 pound	6	800	t	0
b3373689-b86c-49c5-91fd-0b19e61d9083	3 pounds	20	2200	t	2
43212069-414e-4743-a664-0d93ab872aaa	4 pounds	30	3000	t	3
4651ad91-53e5-41fe-a9fc-a523b54bad5e	6 inch	8	0	t	0
b0fb3050-065c-4e9f-a69d-59085020a2c7	8 inch	15	800	t	1
3347091a-8bc0-479b-beac-df70f5608656	10 inch	25	1500	t	2
5530bff3-d4f6-4db6-b175-e73fc637c131	12 inch	40	2500	t	3
\.


--
-- Data for Name: caketier; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.caketier (id, name, description, price_modifier, image_url, is_active, sort_order) FROM stdin;
3fbcf0ba-1067-48ee-a3bd-000fd26940b8	Single Tier	One-layer cake designed for small gatherings and celebrations.	0	\N	t	0
6b6cbc2c-770e-4da1-a1cc-8b250cd50ac7	Two Tier	Two cakes stacked vertically, suitable for medium-sized celebrations.	100	\N	t	1
03093d85-4ea3-4aee-9fe1-0c0ae3db40cb	Three Tier	Three stacked cake layers, ideal for weddings and large events.	300	\N	t	2
89941432-415a-46f9-94e5-b7f7b6eea95f	Four Tier	Four stacked layers for large weddings, corporate events, and grand celebrations.	600	\N	t	3
42cdf987-aa53-443e-9ead-66b01ef73167	Multi Tier	More than four tiers, typically customized for large events and special occasions.	1000	\N	t	4
eb391ee2-9c02-4d76-974b-964635e48386	Mini Tier	Small-sized tier cake, suitable for individual or small-group celebrations.	500	\N	t	5
3f96939c-1e28-40b1-8cd0-1312e72cf549	Custom Tier	Customer-specific tier configuration based on size, servings, design, and event requirements.	0	\N	t	6
\.


--
-- Data for Name: customer; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.customer (id, full_name, phone, email, address_line1, city, notes, created_at) FROM stdin;
\.


--
-- Data for Name: deliveryzone; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.deliveryzone (id, name, distance_from_km, distance_to_km, price, is_active, sort_order) FROM stdin;
938ecaa9-bd95-48b2-9eca-c2afc915f0e3	Zone A	1	5	0	t	0
4f2b1dda-7988-4baa-a19c-9ae6eeb14338	Zone B	6	10	250	t	0
\.


--
-- Data for Name: employeecodesettings; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.employeecodesettings (id, prefix, separator, padding, include_year, next_sequence, updated_at) FROM stdin;
1	CS	-	4	f	3	2026-09-15 22:19:06.397864+05
\.


--
-- Data for Name: expense; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.expense (id, category, amount, description, processing_date, recorded_by_staff_id) FROM stdin;
\.


--
-- Data for Name: inventoryitem; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.inventoryitem (id, name, unit, qty_on_hand, reorder_threshold, supplier_id, is_active, unit_id) FROM stdin;
\.


--
-- Data for Name: loginhistory; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.loginhistory (id, attempted_email, staff_id, success, failure_reason, ip_address, user_agent, created_at) FROM stdin;
2b614b0b-a231-45eb-b5e1-dd16b975a3d4	khizarqadri92@gmail.com	33b6d222-3061-41e3-b558-fa682996e17f	t	\N	127.0.0.1	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/151.0.0.0 Safari/537.36 Edg/151.0.0.0	2026-08-12 17:02:23.314791+05
d2d0f08f-6148-4c31-90b0-d867a03623b7	khizarqadri92@gmail.com	33b6d222-3061-41e3-b558-fa682996e17f	t	\N	127.0.0.1	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/151.0.0.0 Safari/537.36 Edg/151.0.0.0	2026-08-12 18:04:08.449789+05
401756b4-6e6d-4340-9cc0-0288e5981f72	khizarqadri92@gmail.com	33b6d222-3061-41e3-b558-fa682996e17f	f	totp_required	127.0.0.1	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/151.0.0.0 Safari/537.36 Edg/151.0.0.0	2026-08-12 18:06:44.005946+05
a5f35a14-3c11-4e22-ad92-d73b81abf34d	khizarqadri92@gmail.com	33b6d222-3061-41e3-b558-fa682996e17f	t	\N	127.0.0.1	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/151.0.0.0 Safari/537.36 Edg/151.0.0.0	2026-08-12 18:06:59.211821+05
3702bda2-57e8-4c6a-91c8-ea45d7a43dd7	khizarqadri92@gmail.com	33b6d222-3061-41e3-b558-fa682996e17f	f	totp_required	127.0.0.1	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/151.0.0.0 Safari/537.36 Edg/151.0.0.0	2026-08-12 18:46:19.428169+05
cdbd150f-7213-4bf1-843a-c3d44b6525b5	khizarqadri92@gmail.com	33b6d222-3061-41e3-b558-fa682996e17f	f	totp_invalid	127.0.0.1	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/151.0.0.0 Safari/537.36 Edg/151.0.0.0	2026-08-12 18:46:31.518195+05
004eb25f-7d92-47fc-aed9-32767a3fef3f	khizarqadri92@gmail.com	33b6d222-3061-41e3-b558-fa682996e17f	f	totp_required	127.0.0.1	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/151.0.0.0 Safari/537.36 Edg/151.0.0.0	2026-08-13 13:04:08.717256+05
70363fea-107d-4bb2-9ecd-0b431ebea156	khizarqadri92@gmail.com	33b6d222-3061-41e3-b558-fa682996e17f	t	\N	127.0.0.1	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/151.0.0.0 Safari/537.36 Edg/151.0.0.0	2026-08-13 13:04:53.254205+05
ff2bd31b-fffe-45c1-b226-49d9d6606be9	owner@cakestudio.local	0746779e-c05d-406a-9a78-2121750c114f	t	\N	127.0.0.1	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/151.0.0.0 Safari/537.36 Edg/151.0.0.0	2026-08-13 13:12:25.638019+05
29802db6-5ea1-4a69-b3da-a89187581407	khizarqadri92@gmail.com	33b6d222-3061-41e3-b558-fa682996e17f	t	\N	127.0.0.1	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/151.0.0.0 Safari/537.36 Edg/151.0.0.0	2026-08-13 13:13:18.313657+05
97761ded-12dd-436d-9497-b809930e9a60	ayyan@gmail.com	ab242ada-05ef-4ed4-94bf-b300bc8c05dd	t	\N	127.0.0.1	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/151.0.0.0 Safari/537.36 Edg/151.0.0.0	2026-08-13 13:13:59.251373+05
b36baa40-4e66-40d9-84da-7b7be0309fab	khizarqadri92@gmail.com	33b6d222-3061-41e3-b558-fa682996e17f	f	invalid_credentials	127.0.0.1	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/151.0.0.0 Safari/537.36 Edg/151.0.0.0	2026-08-13 13:14:10.966487+05
132372b9-eb3a-4a14-9538-9ee6544f1307	khizarqadri92@gmail.com	33b6d222-3061-41e3-b558-fa682996e17f	t	\N	127.0.0.1	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/151.0.0.0 Safari/537.36 Edg/151.0.0.0	2026-08-13 13:14:16.65894+05
cea4fcac-544e-4439-ab0b-a9fabee43f3a	khizarqadri92@gmail.com	33b6d222-3061-41e3-b558-fa682996e17f	t	\N	127.0.0.1	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/151.0.0.0 Safari/537.36 Edg/151.0.0.0	2026-08-13 13:58:35.074074+05
eb242ae0-fbe0-48e3-aa95-591856740dc2	khizarqadri92@gmail.com	33b6d222-3061-41e3-b558-fa682996e17f	t	\N	127.0.0.1	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/151.0.0.0 Safari/537.36 Edg/151.0.0.0	2026-08-13 14:03:27.862616+05
72013bb6-ed96-4679-a64b-02b9a0454c36	khizarqadri92@gmail.com	33b6d222-3061-41e3-b558-fa682996e17f	t	\N	127.0.0.1	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/151.0.0.0 Safari/537.36 Edg/151.0.0.0	2026-08-13 14:19:48.578071+05
37032260-7b9b-49eb-915a-dcea85f9c91a	khizarqadri92@gmail.com	33b6d222-3061-41e3-b558-fa682996e17f	t	\N	127.0.0.1	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/151.0.0.0 Safari/537.36 Edg/151.0.0.0	2026-08-13 19:43:34.316363+05
08fe4bff-e403-42a6-81c1-6ef7001ac360	khizarqadri92@gmail.com	33b6d222-3061-41e3-b558-fa682996e17f	t	\N	127.0.0.1	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/151.0.0.0 Safari/537.36 Edg/151.0.0.0	2026-08-14 16:41:50.149898+05
f1af4d56-87f9-491b-b024-d9d19c09e4cf	khizarqadri92@gmail.com	33b6d222-3061-41e3-b558-fa682996e17f	t	\N	127.0.0.1	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/151.0.0.0 Safari/537.36 Edg/151.0.0.0	2026-08-14 16:57:09.627054+05
a9b72940-514b-4ccc-a4b9-b5811da96463	khizarqadri92@gmail.com	33b6d222-3061-41e3-b558-fa682996e17f	t	\N	127.0.0.1	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/151.0.0.0 Safari/537.36 Edg/151.0.0.0	2026-08-15 09:53:21.474263+05
7e8a72e0-3e5f-4aa2-b828-9ca2095f71e5	khizarqadri92@gmail.com	33b6d222-3061-41e3-b558-fa682996e17f	t	\N	127.0.0.1	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/151.0.0.0 Safari/537.36 Edg/151.0.0.0	2026-08-15 14:14:28.543528+05
76ebc1e2-f5a5-4326-bca6-2de46e512ad2	khizarqadri92@gmail.com	33b6d222-3061-41e3-b558-fa682996e17f	t	\N	127.0.0.1	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/151.0.0.0 Safari/537.36 Edg/151.0.0.0	2026-08-15 14:15:07.59382+05
3b6bfb91-6828-4aea-bf8e-c6b2beec3b7b	ayyan@gmail.com	ab242ada-05ef-4ed4-94bf-b300bc8c05dd	t	\N	127.0.0.1	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/151.0.0.0 Safari/537.36 Edg/151.0.0.0	2026-08-15 14:15:19.906093+05
1b865303-1609-4d67-afce-43f6b6a4b38d	ayyan@gmail.com	ab242ada-05ef-4ed4-94bf-b300bc8c05dd	t	\N	127.0.0.1	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/151.0.0.0 Safari/537.36	2026-08-15 14:15:49.8197+05
e2fe384f-8805-4184-b5b1-c17bae25574c	khizarqadri92@gmail.com	33b6d222-3061-41e3-b558-fa682996e17f	t	\N	127.0.0.1	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/151.0.0.0 Safari/537.36 Edg/151.0.0.0	2026-08-15 14:16:01.477298+05
27f78ce2-a667-4b2d-b866-17cbb806fddf	ayyan@gmail.com	ab242ada-05ef-4ed4-94bf-b300bc8c05dd	t	\N	127.0.0.1	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/151.0.0.0 Safari/537.36	2026-08-15 14:16:34.707196+05
8d60c25c-7b87-474c-9a6f-2be3dfc33119	khizarqadri92@gmail.com	33b6d222-3061-41e3-b558-fa682996e17f	t	\N	127.0.0.1	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/151.0.0.0 Safari/537.36 Edg/151.0.0.0	2026-08-15 21:58:41.877318+05
e9f55370-1d33-4dc8-b9f2-6621ff5447d9	khizarqadri92@gmail.com	33b6d222-3061-41e3-b558-fa682996e17f	t	\N	127.0.0.1	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/151.0.0.0 Safari/537.36 Edg/151.0.0.0	2026-08-15 22:00:01.261933+05
637f357a-ba9d-4450-bc5b-44e4573a4f05	khizarqadri92@gmail.com	33b6d222-3061-41e3-b558-fa682996e17f	t	\N	127.0.0.1	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/151.0.0.0 Safari/537.36 Edg/151.0.0.0	2026-08-15 22:06:16.051809+05
b14d656c-c286-4baa-b060-1ed8ba18ea4f	khizarqadri92@gmail.com	33b6d222-3061-41e3-b558-fa682996e17f	t	\N	127.0.0.1	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/151.0.0.0 Safari/537.36 Edg/151.0.0.0	2026-08-15 22:07:02.531825+05
a7b18a03-85c4-4f91-8285-2d7bff7564ff	ayyan@gmail.com	ab242ada-05ef-4ed4-94bf-b300bc8c05dd	t	\N	127.0.0.1	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/151.0.0.0 Safari/537.36 Edg/151.0.0.0	2026-08-15 22:18:48.417723+05
72aa4e23-846a-4a2d-8b4d-0c06ec0cffed	khizarqadri92@gmail.com	33b6d222-3061-41e3-b558-fa682996e17f	t	\N	127.0.0.1	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/151.0.0.0 Safari/537.36 Edg/151.0.0.0	2026-08-15 22:19:07.40603+05
f9bc2565-0d11-4b5e-b050-a8a0841dc203	khizarqadri92@gmail.com	33b6d222-3061-41e3-b558-fa682996e17f	f	invalid_credentials	127.0.0.1	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/151.0.0.0 Safari/537.36 Edg/151.0.0.0	2026-08-16 16:24:54.818014+05
2f4b48c6-46cc-4427-ad13-97768119bd84	khizarqadri92@gmail.com	33b6d222-3061-41e3-b558-fa682996e17f	t	\N	127.0.0.1	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/151.0.0.0 Safari/537.36 Edg/151.0.0.0	2026-08-16 16:25:03.973068+05
73bf10de-e2be-4531-8c82-11b9fee2ae90	rawaidah@gmail.com	bb7f0a40-2b83-41d5-b2cc-873db2434876	t	\N	127.0.0.1	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/151.0.0.0 Safari/537.36 Edg/151.0.0.0	2026-08-16 16:27:30.92686+05
62568ae1-f824-4f2e-adb4-5b543b7c762e	khizarqadri92@gmail.com	33b6d222-3061-41e3-b558-fa682996e17f	t	\N	127.0.0.1	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/151.0.0.0 Safari/537.36 Edg/151.0.0.0	2026-08-16 16:46:37.969032+05
01a86826-4455-4e19-be82-fbaf147ea30b	khizarqadri92@gmail.com	33b6d222-3061-41e3-b558-fa682996e17f	t	\N	127.0.0.1	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/151.0.0.0 Safari/537.36 Edg/151.0.0.0	2026-08-16 16:27:43.022759+05
3ae588e8-23e3-4326-8b6c-d97bca3c9a6e	khizarqadri92@gmail.com	33b6d222-3061-41e3-b558-fa682996e17f	t	\N	127.0.0.1	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/151.0.0.0 Safari/537.36 Edg/151.0.0.0	2026-08-16 22:23:44.036845+05
221e7617-5db4-4f25-9ff0-440815b95e10	khizarqadri92@gmail.com	33b6d222-3061-41e3-b558-fa682996e17f	t	\N	127.0.0.1	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/151.0.0.0 Safari/537.36 Edg/151.0.0.0	2026-08-16 22:30:41.204584+05
d29abc30-8241-463f-873f-3a913575930c	khizarqadri92@gmail.com	33b6d222-3061-41e3-b558-fa682996e17f	t	\N	127.0.0.1	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/151.0.0.0 Safari/537.36 Edg/151.0.0.0	2026-08-17 09:33:03.06894+05
2264f828-e3f4-4f6c-8df6-982c11494db6	khizarqadri92@gmail.com	33b6d222-3061-41e3-b558-fa682996e17f	t	\N	127.0.0.1	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/151.0.0.0 Safari/537.36 Edg/151.0.0.0	2026-08-17 16:33:35.993925+05
bc93d371-bb8f-424b-a9c7-a6088ee2f976	khizarqadri92@gmail.com	33b6d222-3061-41e3-b558-fa682996e17f	t	\N	127.0.0.1	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/151.0.0.0 Safari/537.36 Edg/151.0.0.0	2026-08-17 16:37:07.256945+05
d9a255d6-9370-467d-a2d6-36e91da9fdef	khizarqadri92@gmail.com	33b6d222-3061-41e3-b558-fa682996e17f	t	\N	127.0.0.1	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/151.0.0.0 Safari/537.36 Edg/151.0.0.0	2026-08-17 16:40:10.25025+05
1ae4deeb-d0d8-4288-bcfc-fbeda61f3095	khizarqadri92@gmail.com	33b6d222-3061-41e3-b558-fa682996e17f	t	\N	127.0.0.1	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/151.0.0.0 Safari/537.36 Edg/151.0.0.0	2026-08-17 16:43:53.391186+05
38c5ef8e-5697-4c06-9b08-b0cc2cc45230	khizarqadri92@gmail.com	33b6d222-3061-41e3-b558-fa682996e17f	t	\N	127.0.0.1	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/151.0.0.0 Safari/537.36 Edg/151.0.0.0	2026-08-17 16:49:54.221722+05
26c739f8-7fdd-4e43-a325-7eba5c996c62	khizarqadri92@gmail.com	33b6d222-3061-41e3-b558-fa682996e17f	t	\N	127.0.0.1	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/151.0.0.0 Safari/537.36 Edg/151.0.0.0	2026-08-17 16:55:34.618022+05
149d74c9-7873-4016-8192-83bca5f2a6ae	khizarqadri92@gmail.com	33b6d222-3061-41e3-b558-fa682996e17f	t	\N	127.0.0.1	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/151.0.0.0 Safari/537.36 Edg/151.0.0.0	2026-08-18 09:19:48.493221+05
b29117f5-2601-4834-9484-2d77014b484d	khizarqadri92@gmail.com	33b6d222-3061-41e3-b558-fa682996e17f	t	\N	127.0.0.1	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/151.0.0.0 Safari/537.36 Edg/151.0.0.0	2026-08-18 09:20:55.697257+05
e01cd407-014a-4ba3-8192-1056337763b4	khizarqadri92@gmail.com	33b6d222-3061-41e3-b558-fa682996e17f	t	\N	127.0.0.1	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/151.0.0.0 Safari/537.36 Edg/151.0.0.0	2026-08-18 09:40:43.387593+05
504ff7a5-a32d-4f64-9f4c-9b4f53dba894	khizarqadri92@gmail.com	33b6d222-3061-41e3-b558-fa682996e17f	t	\N	127.0.0.1	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/151.0.0.0 Safari/537.36 Edg/151.0.0.0	2026-08-19 09:21:27.984821+05
5284dc7c-ea75-495c-a70b-ad9398da797c	khizarqadri92@gmail.com	33b6d222-3061-41e3-b558-fa682996e17f	t	\N	127.0.0.1	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/151.0.0.0 Safari/537.36 Edg/151.0.0.0	2026-08-20 15:30:09.736927+05
7d099bee-87e0-4006-81cf-7a9d4a426e88	khizarqadri92@gmail.com	33b6d222-3061-41e3-b558-fa682996e17f	t	\N	127.0.0.1	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/151.0.0.0 Safari/537.36 Edg/151.0.0.0	2026-08-20 15:32:46.147049+05
2c936621-f741-42c6-8c7c-a0bc2f428e69	khizarqadri92@gmail.com	33b6d222-3061-41e3-b558-fa682996e17f	t	\N	127.0.0.1	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/151.0.0.0 Safari/537.36 Edg/151.0.0.0	2026-08-21 15:29:19.056025+05
3e5bdcc9-96a0-40d0-92ed-b77fad850915	rawaidah@gmail.com	bb7f0a40-2b83-41d5-b2cc-873db2434876	t	\N	127.0.0.1	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/151.0.0.0 Safari/537.36 Edg/151.0.0.0	2026-08-21 15:32:14.624922+05
e60539c2-6fe2-450d-ab4a-52caa6b6dad0	khizarqadri92@gmail.com	33b6d222-3061-41e3-b558-fa682996e17f	t	\N	127.0.0.1	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/151.0.0.0 Safari/537.36 Edg/151.0.0.0	2026-08-21 15:32:34.2374+05
50cca96b-3e92-467c-bd64-6856ae45d3b2	rawaidah@gmail.com	bb7f0a40-2b83-41d5-b2cc-873db2434876	t	\N	127.0.0.1	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/151.0.0.0 Safari/537.36 Edg/151.0.0.0	2026-08-21 15:33:15.58633+05
bed8a992-29b4-4668-b402-090fa5637085	khizarqadri92@gmail.com	33b6d222-3061-41e3-b558-fa682996e17f	t	\N	127.0.0.1	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/151.0.0.0 Safari/537.36 Edg/151.0.0.0	2026-08-22 14:22:27.050775+05
af94aa3d-c968-4644-bf51-e7cc9bafafda	khizarqadri92@gmail.com	33b6d222-3061-41e3-b558-fa682996e17f	t	\N	127.0.0.1	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/151.0.0.0 Safari/537.36 Edg/151.0.0.0	2026-08-22 14:22:42.408084+05
a32b6b35-7e44-4744-a205-b132d533cb8d	khizarqadri92@gmail.com	33b6d222-3061-41e3-b558-fa682996e17f	t	\N	127.0.0.1	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/151.0.0.0 Safari/537.36 Edg/151.0.0.0	2026-08-24 09:09:27.736634+05
895c8054-8f80-4eea-8f2e-287e41cfc7a9	khizarqadri92@gmail.com	33b6d222-3061-41e3-b558-fa682996e17f	t	\N	127.0.0.1	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/151.0.0.0 Safari/537.36 Edg/151.0.0.0	2026-08-24 09:22:53.533955+05
c8d4c9fa-c44f-41a7-a51f-2a4a976e5b9b	khizarqadri92@gmail.com	33b6d222-3061-41e3-b558-fa682996e17f	t	\N	127.0.0.1	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/151.0.0.0 Safari/537.36 Edg/151.0.0.0	2026-08-24 14:24:23.870095+05
b882313e-a7ee-4ba6-a449-6b9fc1ca01da	khizarqadri92@gmail.com	33b6d222-3061-41e3-b558-fa682996e17f	t	\N	127.0.0.1	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/151.0.0.0 Safari/537.36 Edg/151.0.0.0	2026-08-24 14:24:37.660551+05
2ec305f7-acfa-4d45-af1f-fb3f67786a34	khizarqadri92@gmail.com	33b6d222-3061-41e3-b558-fa682996e17f	t	\N	127.0.0.1	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/151.0.0.0 Safari/537.36 Edg/151.0.0.0	2026-08-25 09:17:48.079711+05
35f99041-41b6-493d-8ef5-62a1d82800cb	khizarqadri92@gmail.com	33b6d222-3061-41e3-b558-fa682996e17f	t	\N	127.0.0.1	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/151.0.0.0 Safari/537.36 Edg/151.0.0.0	2026-08-25 14:37:48.760614+05
c4f73805-db0a-4bae-a485-e58d7f8af73c	khizarqadri92@gmail.com	33b6d222-3061-41e3-b558-fa682996e17f	t	\N	127.0.0.1	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/151.0.0.0 Safari/537.36 Edg/151.0.0.0	2026-08-26 23:45:44.395007+05
c0c8a311-3928-4116-8d9b-5b19de373261	rawaidah@gmail.com	bb7f0a40-2b83-41d5-b2cc-873db2434876	t	\N	127.0.0.1	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/151.0.0.0 Safari/537.36 Edg/151.0.0.0	2026-08-26 23:49:12.017652+05
f42b6050-e576-401a-bb3e-9be02930bc1f	khizarqadri92@gmail.com	33b6d222-3061-41e3-b558-fa682996e17f	t	\N	127.0.0.1	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/151.0.0.0 Safari/537.36 Edg/151.0.0.0	2026-08-26 23:49:44.160503+05
c96867cd-6d98-4835-9dfb-bc2f54d89acc	rawaidah@gmail.com	bb7f0a40-2b83-41d5-b2cc-873db2434876	t	\N	127.0.0.1	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/151.0.0.0 Safari/537.36 Edg/151.0.0.0	2026-08-29 09:11:10.993186+05
1b59aae2-3e47-4b76-ba05-cd351f732f58	rawaidah@gmail.com	bb7f0a40-2b83-41d5-b2cc-873db2434876	t	\N	127.0.0.1	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/152.0.0.0 Safari/537.36 Edg/152.0.0.0	2026-08-30 23:24:50.747288+05
49a77fb0-758e-44a2-9f62-8b0a779bee65	khizarqadri92@gmail.com	33b6d222-3061-41e3-b558-fa682996e17f	t	\N	127.0.0.1	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/152.0.0.0 Safari/537.36 Edg/152.0.0.0	2026-08-31 09:13:23.710394+05
9c95dca8-21cb-40de-b3c0-74e238cf1029	khizarqadri92@gmail.com	33b6d222-3061-41e3-b558-fa682996e17f	t	\N	127.0.0.1	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/152.0.0.0 Safari/537.36 Edg/152.0.0.0	2026-09-02 08:42:16.786902+05
7808a4b1-31db-497b-8aea-dd9cfe150812	rawaidah@gmail.com	bb7f0a40-2b83-41d5-b2cc-873db2434876	t	\N	127.0.0.1	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/152.0.0.0 Safari/537.36 Edg/152.0.0.0	2026-09-02 08:49:01.907924+05
6c521fcb-0b5f-43b8-b132-8b7720151df2	khizarqadri92@gmail.com	33b6d222-3061-41e3-b558-fa682996e17f	t	\N	127.0.0.1	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/152.0.0.0 Safari/537.36 Edg/152.0.0.0	2026-09-02 08:50:58.634704+05
910b7034-25ac-4c5f-8e37-51149f2c5827	khizarqadri92@gmail.com	33b6d222-3061-41e3-b558-fa682996e17f	t	\N	127.0.0.1	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/153.0.0.0 Safari/537.36 Edg/153.0.0.0	2026-09-15 22:17:42.656542+05
7d23669e-ce3e-416d-9129-0360a91c07fe	khizarqadri92@gmail.com	33b6d222-3061-41e3-b558-fa682996e17f	t	\N	127.0.0.1	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/153.0.0.0 Safari/537.36 Edg/153.0.0.0	2026-09-15 22:24:27.005205+05
33b7c9c1-ca7a-4b0b-bca7-cb3368d25088	khizarqadri92@gmail.com	33b6d222-3061-41e3-b558-fa682996e17f	t	\N	127.0.0.1	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/152.0.0.0 Safari/537.36	2026-09-16 09:04:57.885263+05
aec3350d-a87c-45ea-9d54-f0bd7be5fc09	khizarqadri92@gmail.com	33b6d222-3061-41e3-b558-fa682996e17f	t	\N	127.0.0.1	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/152.0.0.0 Safari/537.36	2026-09-16 09:07:37.979287+05
85f75885-766c-418e-8dd8-0fc322c648d2	kalsoom@gmail.com	d7c143c3-72a0-43ba-a3b1-5964cffa522c	t	\N	127.0.0.1	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/152.0.0.0 Safari/537.36	2026-09-16 09:08:23.881483+05
be381d88-6423-4ee9-9d2a-2a7245199b0b	kalsoom@gmail.com	d7c143c3-72a0-43ba-a3b1-5964cffa522c	t	\N	127.0.0.1	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/152.0.0.0 Safari/537.36	2026-09-16 14:23:05.39276+05
ca8e26ab-fe5c-41c6-8a26-7867a25ff1df	kalsoom@gmail.com	d7c143c3-72a0-43ba-a3b1-5964cffa522c	t	\N	127.0.0.1	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/152.0.0.0 Safari/537.36	2026-09-16 14:52:15.950885+05
863fe980-9230-49c3-baf0-70bd3340bdbc	kalsoom@gmail.com	d7c143c3-72a0-43ba-a3b1-5964cffa522c	t	\N	127.0.0.1	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/153.0.0.0 Safari/537.36	2026-09-18 10:26:44.949337+05
ac648353-6a9d-40cf-a7b8-0fb2ed338076	rawaidah@gmaill.com	\N	f	invalid_credentials	127.0.0.1	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/153.0.0.0 Safari/537.36	2026-09-24 22:12:00.289879+05
f9317582-e5b3-4eb9-9318-3e8215f4eb95	khizarqadri92@gmail.com	33b6d222-3061-41e3-b558-fa682996e17f	t	\N	127.0.0.1	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/153.0.0.0 Safari/537.36	2026-09-24 22:12:07.829526+05
e56ca969-478a-414e-984c-cc0fe5b497b5	kalsoom@gmail.com	d7c143c3-72a0-43ba-a3b1-5964cffa522c	t	\N	127.0.0.1	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/153.0.0.0 Safari/537.36	2026-09-24 22:12:24.677876+05
b20ed8a7-7785-4036-b0b3-69d412a0364c	kalsoom@gmail.com	d7c143c3-72a0-43ba-a3b1-5964cffa522c	t	\N	127.0.0.1	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/153.0.0.0 Safari/537.36	2026-09-24 22:16:07.73708+05
3018376f-90fe-4e80-ac98-521b0b455614	kalsoom@gmail.com	d7c143c3-72a0-43ba-a3b1-5964cffa522c	t	\N	127.0.0.1	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/153.0.0.0 Safari/537.36	2026-09-24 22:19:29.71702+05
5bdf508b-0c78-4fd9-aa50-43dea7e77c6a	khizarqadri92@gmail.com	33b6d222-3061-41e3-b558-fa682996e17f	t	\N	127.0.0.1	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/153.0.0.0 Safari/537.36	2026-09-24 22:20:16.114372+05
3dca662f-7679-4901-9613-7622c8a1e4f6	kalsoom@gmail.com	d7c143c3-72a0-43ba-a3b1-5964cffa522c	t	\N	127.0.0.1	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/153.0.0.0 Safari/537.36	2026-09-24 22:23:44.216274+05
ad782655-39f4-479c-a38c-19e34096d34e	khizarqadri92@gmail.com	33b6d222-3061-41e3-b558-fa682996e17f	t	\N	127.0.0.1	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/153.0.0.0 Safari/537.36	2026-09-24 22:25:14.554197+05
2b929eec-1713-493b-8d53-4eb1728f2336	kalsoom@gmail.com	d7c143c3-72a0-43ba-a3b1-5964cffa522c	t	\N	127.0.0.1	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/153.0.0.0 Safari/537.36	2026-09-24 22:28:25.892895+05
497f221a-19a9-4551-ae01-cbeb70021e4e	khizarqadri92@gmail.com	33b6d222-3061-41e3-b558-fa682996e17f	t	\N	127.0.0.1	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/153.0.0.0 Safari/537.36	2026-09-24 22:29:11.312069+05
0e4416f0-c67e-479e-8f2c-015382628d52	ayyan@gmail.com	ab242ada-05ef-4ed4-94bf-b300bc8c05dd	t	\N	127.0.0.1	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/153.0.0.0 Safari/537.36	2026-09-24 22:29:27.556664+05
7a717d06-03dc-48ed-887c-baafc6efebb6	ayyan@gmail.com	ab242ada-05ef-4ed4-94bf-b300bc8c05dd	t	\N	127.0.0.1	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/153.0.0.0 Safari/537.36	2026-09-24 22:30:36.660771+05
b99a6ca7-c8ae-4daf-9d5b-1b508912e0ca	khizarqadri92@gmail.com	33b6d222-3061-41e3-b558-fa682996e17f	t	\N	127.0.0.1	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/153.0.0.0 Safari/537.36	2026-09-24 22:30:53.529267+05
cfa93aa6-bf5e-4320-87d7-8e2c29f43c61	ayyan@gmail.com	ab242ada-05ef-4ed4-94bf-b300bc8c05dd	t	\N	127.0.0.1	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/153.0.0.0 Safari/537.36	2026-09-24 22:42:17.520701+05
b9356c8a-3329-4a5b-b473-fad9dc96308f	khizarqadri92@gmail.com	33b6d222-3061-41e3-b558-fa682996e17f	t	\N	127.0.0.1	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/153.0.0.0 Safari/537.36	2026-09-24 22:54:19.857847+05
7871da3b-70d7-4c1f-afa9-b5f17aad6333	khizarqadri92@gmail.com	33b6d222-3061-41e3-b558-fa682996e17f	f	invalid_credentials	127.0.0.1	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/154.0.0.0 Safari/537.36	2026-09-25 17:08:01.959625+05
9f6c6c48-0746-4f5e-803e-42416ed4fec7	khizarqadri92@gmail.com	33b6d222-3061-41e3-b558-fa682996e17f	t	\N	127.0.0.1	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/154.0.0.0 Safari/537.36	2026-09-25 17:08:06.621184+05
89bbe2b8-e766-40f3-bb1b-63310e84d960	kalsoom@gmail.com	d7c143c3-72a0-43ba-a3b1-5964cffa522c	t	\N	127.0.0.1	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/154.0.0.0 Safari/537.36	2026-09-25 17:12:36.384734+05
4901557e-4bfc-4abe-b640-becaaa4a1299	khizarqadri92@gmail.com	33b6d222-3061-41e3-b558-fa682996e17f	t	\N	127.0.0.1	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/154.0.0.0 Safari/537.36	2026-09-25 17:13:21.95844+05
29fa98ac-92a0-409b-a383-56b87a77e735	rawaidah@gmail.com	bb7f0a40-2b83-41d5-b2cc-873db2434876	t	\N	127.0.0.1	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/154.0.0.0 Safari/537.36	2026-09-25 17:13:44.577276+05
63ae0877-1458-4e50-90a3-2f4c95dad2a2	khizarqadri92@gmail.com	33b6d222-3061-41e3-b558-fa682996e17f	t	\N	127.0.0.1	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/154.0.0.0 Safari/537.36	2026-09-25 17:19:33.761947+05
38aff253-9bbb-4237-ad80-610cb5da355a	rawaidah@gmaill.com	\N	f	invalid_credentials	127.0.0.1	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/154.0.0.0 Safari/537.36	2026-09-25 17:22:00.426297+05
a28f067e-3638-4105-a5c8-3009afee1d91	rawaidah@gmaill.com	\N	f	invalid_credentials	127.0.0.1	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/154.0.0.0 Safari/537.36	2026-09-25 17:22:05.848672+05
d04dcced-07ef-4a47-bfc4-904b1dbf68c9	rawaidah@gmaill.com	\N	f	invalid_credentials	127.0.0.1	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/154.0.0.0 Safari/537.36	2026-09-25 17:22:13.075655+05
07aa23ef-f597-44a1-9303-2441512705df	rawaidah@gmail.com	bb7f0a40-2b83-41d5-b2cc-873db2434876	t	\N	127.0.0.1	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/154.0.0.0 Safari/537.36	2026-09-25 17:22:26.278429+05
0fdbe409-a981-46b8-8824-5983113560a1	rawaidah@gmail.com	bb7f0a40-2b83-41d5-b2cc-873db2434876	t	\N	127.0.0.1	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/154.0.0.0 Safari/537.36	2026-09-25 17:30:38.104664+05
b537de2d-355a-45a3-ab4c-597d7fad6ee2	rawaidah@gmail.com	bb7f0a40-2b83-41d5-b2cc-873db2434876	t	\N	127.0.0.1	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/154.0.0.0 Safari/537.36	2026-09-25 17:31:36.946096+05
4f60a33f-da52-4ff5-801f-e91c06bc5822	khizarqadri92@gmail.com	33b6d222-3061-41e3-b558-fa682996e17f	t	\N	127.0.0.1	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/154.0.0.0 Safari/537.36	2026-09-25 17:32:01.982201+05
6449ea3a-cddd-43eb-84aa-7bf214b37b2e	khizarqadri92@gmail.com	33b6d222-3061-41e3-b558-fa682996e17f	t	\N	127.0.0.1	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/154.0.0.0 Safari/537.36	2026-09-25 17:38:31.161135+05
db56aca0-ce25-48c1-88b1-54d5372851e8	rawaidah@gmaill.com	\N	f	invalid_credentials	127.0.0.1	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/154.0.0.0 Safari/537.36	2026-09-25 17:44:06.979534+05
35a3546f-ab9c-4eba-a572-6fe166b7c630	rawaidah@gmail.com	bb7f0a40-2b83-41d5-b2cc-873db2434876	t	\N	127.0.0.1	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/154.0.0.0 Safari/537.36	2026-09-25 17:44:12.880743+05
853a30c7-4c6f-43af-b2ec-5159be7fdafd	rawaidah@gmail.com	bb7f0a40-2b83-41d5-b2cc-873db2434876	t	\N	127.0.0.1	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/154.0.0.0 Safari/537.36	2026-09-25 17:56:39.81824+05
ac2b8e06-34e3-4cd1-b05f-2007d1e4cabb	rawaidah@gmaill.com	\N	f	invalid_credentials	127.0.0.1	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/154.0.0.0 Safari/537.36	2026-09-25 17:57:02.26245+05
614852ed-2865-427e-b780-8c1260a8b0a6	rawaidah@gmail.com	bb7f0a40-2b83-41d5-b2cc-873db2434876	t	\N	127.0.0.1	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/154.0.0.0 Safari/537.36	2026-09-25 17:57:11.681154+05
5b858b7f-a51f-4b02-a2f1-09583604a8bb	rawaidah@gmail.com	bb7f0a40-2b83-41d5-b2cc-873db2434876	t	\N	127.0.0.1	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/154.0.0.0 Safari/537.36	2026-09-25 22:26:31.030512+05
023e7217-ef17-4c18-aa11-a9bdff5cb060	rawaidah@gmail.com	bb7f0a40-2b83-41d5-b2cc-873db2434876	t	\N	127.0.0.1	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/154.0.0.0 Safari/537.36	2026-09-25 22:32:57.405352+05
16d9af25-b21c-4141-8484-859295f12fc1	khizarqadri92@gmail.com	33b6d222-3061-41e3-b558-fa682996e17f	t	\N	127.0.0.1	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/154.0.0.0 Safari/537.36	2026-09-25 22:34:25.471965+05
a0e424c6-72c8-4a0b-88d6-f3a4db9a82f5	khizarqadri92@gmail.com	33b6d222-3061-41e3-b558-fa682996e17f	t	\N	127.0.0.1	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/154.0.0.0 Safari/537.36	2026-09-25 23:28:37.098542+05
f3b78e69-1fa4-452b-9bec-270f4efc3039	rawaidah@gmail.com	bb7f0a40-2b83-41d5-b2cc-873db2434876	t	\N	127.0.0.1	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/154.0.0.0 Safari/537.36	2026-09-25 23:30:37.28231+05
82c2adb8-3cab-4b61-a428-11ead6c184c8	khizarqadri92@gmail.com	33b6d222-3061-41e3-b558-fa682996e17f	t	\N	127.0.0.1	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/154.0.0.0 Safari/537.36	2026-09-26 09:15:03.635809+05
d266f657-9728-45c7-b7c2-a9c24ff77af5	khizarqadri92@gmail.com	33b6d222-3061-41e3-b558-fa682996e17f	t	\N	127.0.0.1	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/154.0.0.0 Safari/537.36	2026-09-26 09:33:24.606908+05
907bb8da-9b55-4614-8b6c-dc1f0d76385b	khizarqadri92@gmail.com	33b6d222-3061-41e3-b558-fa682996e17f	t	\N	127.0.0.1	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/154.0.0.0 Safari/537.36	2026-09-26 09:52:03.018381+05
54447812-217f-4f4d-bfbb-aac995cdeed7	kalsoom@gmail.com	d7c143c3-72a0-43ba-a3b1-5964cffa522c	t	\N	127.0.0.1	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/154.0.0.0 Safari/537.36	2026-09-26 09:57:26.2561+05
f2b90663-f0ce-4524-9d2b-7790172f447b	khizarqadri92@gmail.com	33b6d222-3061-41e3-b558-fa682996e17f	t	\N	127.0.0.1	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/154.0.0.0 Safari/537.36	2026-09-26 09:58:30.209532+05
377758bb-4004-4f93-9e4c-3f9a6b2f2f24	khizarqadri92@gmail.com	33b6d222-3061-41e3-b558-fa682996e17f	f	invalid_credentials	127.0.0.1	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/154.0.0.0 Safari/537.36	2026-09-26 10:09:05.196797+05
c3d1ed5d-1c02-47ab-8f03-9a256da4cf6f	khizarqadri92@gmail.com	33b6d222-3061-41e3-b558-fa682996e17f	t	\N	127.0.0.1	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/154.0.0.0 Safari/537.36	2026-09-26 10:09:10.735637+05
81814674-a7e3-4e58-9be5-d532c1edef9f	khizarqadri92@gmail.com	33b6d222-3061-41e3-b558-fa682996e17f	t	\N	127.0.0.1	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/154.0.0.0 Safari/537.36	2026-09-26 10:31:08.797237+05
540a9d69-ac24-40ed-9d0d-1f7d971e3d7c	khizarqadri92@gmail.com	33b6d222-3061-41e3-b558-fa682996e17f	t	\N	127.0.0.1	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/154.0.0.0 Safari/537.36	2026-09-26 14:45:07.253069+05
117f9ded-c6b5-4c13-a295-0f8afe57e353	kalsoom@gmail.com	d7c143c3-72a0-43ba-a3b1-5964cffa522c	t	\N	127.0.0.1	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/154.0.0.0 Safari/537.36	2026-09-26 14:50:54.557382+05
a7341d65-545a-4b01-8fdf-a0ccce9216a3	kalsoom@gmail.com	d7c143c3-72a0-43ba-a3b1-5964cffa522c	f	invalid_credentials	127.0.0.1	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/154.0.0.0 Safari/537.36	2026-09-26 15:09:42.902592+05
2963fe0a-0008-4b2c-bde6-78919bc35705	kalsoom@gmail.com	d7c143c3-72a0-43ba-a3b1-5964cffa522c	t	\N	127.0.0.1	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/154.0.0.0 Safari/537.36	2026-09-26 15:09:47.182702+05
a8939523-367a-42b5-873c-e1e6e5c563a6	khizarqadri92@gmail.com	33b6d222-3061-41e3-b558-fa682996e17f	t	\N	127.0.0.1	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/154.0.0.0 Safari/537.36	2026-09-26 15:11:49.120953+05
3d158f5d-cc8f-4263-8c26-19f59351cfa5	khizarqadri92@gmail.com	33b6d222-3061-41e3-b558-fa682996e17f	t	\N	127.0.0.1	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/154.0.0.0 Safari/537.36	2026-09-26 15:20:34.229802+05
\.


--
-- Data for Name: order; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public."order" (id, order_number, customer_id, branch_id, status, fulfillment_type, delivery_zone_id, delivery_address, delivery_date, delivery_time, subtotal, delivery_charge, discount, total, advance_paid, notes, created_by_staff_id, created_at, confirmed_at, confirmed_by_staff_id, sent_to_baker_at, sent_to_baker_by_staff_id, baker_staff_id, production_started_at, ready_at, rider_staff_id, assigned_rider_at, amount_received, handover_at, handover_by_staff_id, baker_accepted_at, decline_reason, declined_at, declined_by_staff_id, delivery_started_at, delivered_at, rider_amount_collected, business_date) FROM stdin;
\.


--
-- Data for Name: orderingredientusage; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.orderingredientusage (id, order_id, inventory_item_id, quantity_used, recorded_by_staff_id, recorded_at, entered_quantity, entered_unit, processing_date) FROM stdin;
\.


--
-- Data for Name: orderitem; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.orderitem (id, order_id, cake_flavor_id, cake_filling_id, cake_frosting_id, cake_shape_id, cake_size_id, theme_id, cake_box_id, custom_message, special_instructions, quantity, unit_price, line_total, cake_tier_id, is_customer_design, reference_image_url, cake_color_id) FROM stdin;
\.


--
-- Data for Name: orderitemaddon; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.orderitemaddon (id, order_item_id, addon_id, quantity, unit_price) FROM stdin;
\.


--
-- Data for Name: ordersequence; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.ordersequence (id, next_number) FROM stdin;
1	1
\.


--
-- Data for Name: organization; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.organization (id, company_name, legal_name, registration_number, tax_number, business_type, industry, logo_url, favicon_url, address_line1, address_line2, city, state, country, postal_code, phone_primary, phone_secondary, email_primary, email_secondary, website_url, business_hours, timezone, default_language, default_currency, date_format, number_format, updated_at, time_format) FROM stdin;
1	Cake Studio	\N	\N	\N	Sole proprietorship	Bakery and Confectionary	/static/uploads/logos/8cc0a7ef-fd4a-49f7-8d26-61ee08355319.png	/static/uploads/favicons/d44c89c0-2c11-46d2-8bc2-ea2d974937fb.png	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	{"mon": {"open": "09:00", "close": "22:00", "closed": false}, "tue": {"open": "09:00", "close": "22:00", "closed": false}, "wed": {"open": "09:00", "close": "22:00", "closed": false}, "thu": {"open": "09:00", "close": "22:00", "closed": false}, "fri": {"open": "09:00", "close": "22:00", "closed": false}, "sat": {"open": "09:00", "close": "22:00", "closed": false}, "sun": {"open": "09:00", "close": "22:00", "closed": false}}	Asia/Karachi	en	PKR	D MMM YYYY	1,234.56	2026-08-18 09:41:16.778674+05	hh:mm A
\.


--
-- Data for Name: permission; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.permission (id, key, description) FROM stdin;
f1526806-3332-4c27-b539-dbdbf39a7795	system.config.page.view	View system setup page
2ee6bd04-9ea4-48f0-a71f-971c7caed907	system.config.field.business_name.edit	Edit business name
44aeabe3-fee1-4ebd-bd92-44990df80ae6	system.config.field.timezone.edit	Edit timezone
9453642f-441c-4207-9f72-e075d82aeab9	system.config.field.processing_date.edit	Advance the processing date
0a084f8c-924e-4e58-ae03-fc32fa37818e	permissions.page.view	View role and permission management page
2f572c34-c1bf-4092-b653-68804dd8f9b3	permissions.role.create	Create a new role
2e023eb1-9c56-4545-b08c-7711dcbb5af9	permissions.role.edit	Edit a role's name or description
981105e4-0bf6-44dc-a9f6-7939ce50d9ec	permissions.role.assign_permission	Attach/detach permissions on a role
6cab2a75-2498-45fc-92f4-b9b050ae3ae2	permissions.staffoverride.edit	Grant/deny per-user permission overrides
9d4a95fa-4baf-4b57-8ae6-c9769ac8526f	staff.page.view	View staff management page
b78d27f4-930d-4453-a3ab-91453f1431c9	staff.button.create	Create a new staff account
62d2a8c9-7a63-4cf5-9f8d-b15588d671df	staff.field.role.edit	Assign roles to a staff member
0955ac7f-835e-409f-a5b5-122abad1096c	organization.page.view	View organization profile page
5e8de4d1-8616-47f9-8844-6a671ec61a5f	organization.field.identity.edit	Edit company name, legal name, registration, tax number, type, industry
e0291750-6f8e-44a8-98fa-c547162664bf	organization.field.branding.edit	Edit logo and favicon
ce037ca5-e3ca-4a85-a84f-f020f59e7694	organization.field.contact.edit	Edit address, phone, email, website
8984afc6-5019-4fe8-b9a5-e60456785c06	organization.field.hours.edit	Edit business hours and timezone
1ea044ba-14f2-4dc9-a2f7-a9fafd20dff5	organization.field.locale.edit	Edit language, currency, date and number format
fd72dad8-9cc8-4d11-add0-7535711d57ea	branches.page.view	View branches page
6a98d096-4c96-476f-8d05-f0c84ef6f312	branches.button.create	Create a new branch
f253db10-621e-4a7e-899f-1ff6d8e2f21a	branches.field.details.edit	Edit branch name, code, address, contact, manager
ee8e2e57-b02d-477c-b9bd-485230ec3861	branches.field.hours.edit	Edit branch hours, timezone, currency
c01aeee6-b96c-4a8a-b799-81a82218cef8	branches.field.status.edit	Activate/deactivate a branch and set the default branch
c1aeace5-dc07-4646-bf8f-75ac33530ab6	permissions.role.delete	Delete a role that has no staff assigned
a9f57870-c778-4de7-97e2-0bb926ef34bc	staff.field.status.edit	Activate/deactivate a staff account
a1d75949-8124-4cdc-925c-5a6df46f9919	access_policy.page.view	View user and access configuration page
ebf48f30-1d2f-429d-8b41-c435b57f6562	access_policy.field.edit	Edit password policy, lockout, session, IP and default role rules
85666fc6-2709-412d-8265-9b33b92424e1	login_history.page.view	View login history
29dae6cf-3d0e-4e9c-acad-e3dc8aba6b9e	audit_trail.page.view	View the audit trail
64533dd4-b153-45fd-8487-4400908b72f6	system.config.field.employee_code_format.edit	Configure the auto-generated employee code format
d5d14170-a853-47d9-81c6-0f8d9ee21098	staff.field.profile.edit	Edit a staff member's profile details
67a8ac95-ef13-41d8-bd7c-c10c6dd779e4	cake_flavors.page.view	View Cake flavours setup page
901336e8-9dce-4e1f-8865-d156f923c758	cake_flavors.button.create	Add a new cake flavours item
71899777-785c-44ed-b64a-d783e22d593b	cake_flavors.field.edit	Edit a cake flavours item
1969d306-1928-4078-af30-13221fc671df	cake_flavors.button.delete	Delete a cake flavours item
37b44f04-851d-4441-9385-b1e321c9edb6	cake_fillings.page.view	View Cake fillings setup page
8b62a76c-aebe-400d-ada2-1ae97a8f1d8f	cake_fillings.button.create	Add a new cake fillings item
dfae6d14-3cbe-4262-8db4-3abd20cad537	cake_fillings.field.edit	Edit a cake fillings item
8c0fedf1-3a51-4b20-8df1-993dec2e0da3	cake_fillings.button.delete	Delete a cake fillings item
e2d78d2c-435d-4a54-bb3c-6b94a5a72c52	cake_frostings.page.view	View Cake frostings setup page
075ceded-ac61-49fa-a0bd-900c5a925974	cake_frostings.button.create	Add a new cake frostings item
8e61435d-9ca1-43d8-9faf-f227bed6029d	cake_frostings.field.edit	Edit a cake frostings item
bd0873d2-1876-462c-a26f-e4ede301b5d8	cake_frostings.button.delete	Delete a cake frostings item
6be41c9c-6221-44cd-beee-2259b0092bdd	cake_shapes.page.view	View Cake shapes setup page
6dcf42ee-d200-4db7-9ed1-8da1fdc8f700	cake_shapes.button.create	Add a new cake shapes item
c59b898c-0b9e-42f5-bdd1-e351613a6b34	cake_shapes.field.edit	Edit a cake shapes item
071acda5-abcc-43de-88f1-5a6b0d12a6f2	cake_shapes.button.delete	Delete a cake shapes item
dbfce6c0-b8d4-4261-9bdc-b426840e3877	cake_sizes.page.view	View Cake sizes setup page
f5af4b8d-80ad-4b02-8001-764cd9b089ad	cake_sizes.button.create	Add a new cake sizes item
dd79c21f-9e20-447e-a5d6-df244ff8e292	cake_sizes.field.edit	Edit a cake sizes item
151a7ae2-3363-4023-a434-121c6160d7bd	cake_sizes.button.delete	Delete a cake sizes item
410ec45a-72c4-442d-a7c7-86bb5e12a639	themes.page.view	View Themes / occasions setup page
87014ccc-0901-4bed-866e-4821751763b2	themes.button.create	Add a new themes / occasions item
f969f1d1-fede-411d-81ce-edc58d0a9594	themes.field.edit	Edit a themes / occasions item
7bf4aaf0-3e85-445e-85b3-b17af59398a4	themes.button.delete	Delete a themes / occasions item
52c8ee40-89fc-46ab-a8a6-5a24e043a266	cake_addons.page.view	View Decorations / add-ons setup page
489515f3-4deb-4aff-bc11-5e2e642b4fd8	cake_addons.button.create	Add a new decorations / add-ons item
e0c26039-2dda-4927-8dcb-617b214af5e5	cake_addons.field.edit	Edit a decorations / add-ons item
2da7edab-b0f5-4348-a202-c254c870e322	cake_addons.button.delete	Delete a decorations / add-ons item
48de6454-6b7f-4c19-bd63-e139fe706628	cake_boxes.page.view	View Cake boxes setup page
d1a77e32-8c9b-4825-95c5-a69a01b736fc	cake_boxes.button.create	Add a new cake boxes item
140826e4-e74e-4b20-83f0-b6b422b2dbbb	cake_boxes.field.edit	Edit a cake boxes item
faaf1794-fee1-4cc3-9d26-6ac56ac033d3	cake_boxes.button.delete	Delete a cake boxes item
0b496c30-16f4-4f44-a214-749a5faca912	delivery_zones.page.view	View delivery zones setup page
8ee6b1f3-9a34-46ad-ac14-de541879e4a0	delivery_zones.button.create	Add a new delivery zone
2b2750a9-f31a-47dd-8f13-7d8749088838	delivery_zones.field.edit	Edit a delivery zone
42d47823-4e5c-4ccc-96ba-2ddee795e757	delivery_zones.button.delete	Delete a delivery zone
bb575334-548b-4b75-aad4-43bb2818419b	orders.page.view	View the order list and order details
8a3df61a-24da-45e6-bade-66223cb5c328	orders.button.create	Create a new order and search/add customers
5250ae79-d50d-469c-9bd3-c5b431d4abc4	orders.field.edit	Edit a draft order
1e8817f2-6de4-4bb7-957d-e0cfbec92298	orders.button.confirm	Confirm a draft order
b26980f8-5eb1-43d2-903c-851e7c871f0b	orders.button.send_to_baker	Send a confirmed order to the baker
6efb229a-c02d-433a-945b-cc651c01bc01	orders.button.cancel	Cancel an order
78ee0d43-6c82-4d37-8212-fc6197f4c756	cake_tiers.page.view	View Cake tiers setup page
e695f89d-1a86-4e16-a4c4-c16bccd5786f	cake_tiers.button.create	Add a new cake tiers item
687af0d4-f4b0-4dae-a9d3-c42f900e9e9b	cake_tiers.field.edit	Edit a cake tiers item
af584ea5-110d-41c3-992a-9df2d1fd5ba8	cake_tiers.button.delete	Delete a cake tiers item
8ae64777-b44d-4e66-8ea9-9f8abad60b0b	cake_colors.page.view	View Cake colors setup page
7f55188d-85a4-4272-a470-6ad01230696a	cake_colors.button.create	Add a new cake colors item
5e6c6ba6-a567-41c7-980b-afcb72860a88	cake_colors.field.edit	Edit a cake colors item
736bc512-fdc3-4f07-bf16-a05540291795	cake_colors.button.delete	Delete a cake colors item
f2ec55d9-e24e-4fde-9111-2cace1a2e3ed	orders.button.start_baking	Log ingredient usage and start production on an order
dcaebb1b-35c1-406c-b8fa-a461d059978b	orders.button.mark_ready	Mark an order ready for delivery/pickup
70b5dee0-31dd-4066-b79b-9a41a5fc1d54	orders.button.assign_rider	Assign a delivery rider to a ready order
279578e1-4652-499e-ab60-57016c2f5d08	orders.button.handover	Record payment and complete pickup/delivery handover
9f3658f1-d2c2-405d-9c3f-ba0d0a051ef2	inventory.page.view	View the ingredient inventory list
041aebe6-15d8-4401-bd55-bac4d665bcda	inventory.button.create	Add a new ingredient to inventory
fb611a91-3a35-40f2-8d73-3c654e78d7c8	inventory.field.edit	Edit an ingredient's stock details
933d9e48-f59d-4ae5-af58-2434403b0543	inventory.button.delete	Delete an inventory item or supplier
806b8f84-3b4c-4e97-916b-56f5a1db11ae	inventory.button.adjust_stock	Record a manual stock adjustment (purchase, wastage, correction)
ac2581fb-f02b-44f1-bf0c-d607715c4a78	orders.button.accept_baking	Accept or decline an order assigned to you for baking
c4f71cde-2260-4024-bf75-21ee65b9cba9	orders.button.start_delivery	Rider: start the delivery trip for an order assigned to you
6ad0d67e-d3ad-4156-a545-73935c3b2514	orders.button.mark_delivered	Rider: mark your delivery done and enter the amount collected
b3f1cf91-7952-4062-81a0-1c6ed49fa799	system.config.field.decimals.edit	Set decimal places for amounts and quantities
476b5194-c9a4-4c4c-aaa3-51e6211a3124	system.config.field.printer.edit	Set up kitchen ticket printing
efd4a83a-2734-4d99-a7ed-8be6d9703b36	orders.button.print	Print or reprint an order's kitchen ticket
8ae352d5-2f4a-4822-9bf7-3dafdf3cfc45	reports.page.view	Open the Reports section
5e82d89f-7268-4a32-8bce-85774be0e186	reports.orders.view	Reports: orders, best sellers, money outstanding
fab34bc9-203b-439a-8737-3a19bc56aeda	reports.inventory.view	Reports: ingredients used, purchases, stock value and wastage
c7b5e94e-c7a5-4bb3-9d3d-f12624c34e20	reports.profit.view	Reports: cake cost and profit
56d02e98-2992-4178-9b35-615751c275be	reports.staff.view	Reports: baker and rider performance
12d5951d-fac8-4a9c-9aab-9442a7380d6f	reports.customers.view	Reports: customers
\.


--
-- Data for Name: printjob; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.printjob (id, order_id, kind, reason, mode, status, error, printer, created_by_staff_id, created_at) FROM stdin;
\.


--
-- Data for Name: processingdatelog; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.processingdatelog (id, old_date, new_date, changed_by_staff_id, reason, changed_at) FROM stdin;
852409a2-1ab3-4f14-94b7-2fe6e28764ca	2026-08-11	2026-08-12	0746779e-c05d-406a-9a78-2121750c114f	\N	2026-08-11 16:30:35.764087+05
4ce24dee-73ea-4d07-899c-ec740a87b354	2026-08-12	2026-09-26	33b6d222-3061-41e3-b558-fa682996e17f	\N	2026-09-26 14:45:24.087804+05
\.


--
-- Data for Name: purchase; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.purchase (id, supplier_id, invoice_number, purchase_date, notes, total_amount, created_by_staff_id, created_at) FROM stdin;
\.


--
-- Data for Name: purchaseitem; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.purchaseitem (id, purchase_id, inventory_item_id, quantity, unit_price, line_total, entered_quantity, entered_unit, entered_unit_price) FROM stdin;
\.


--
-- Data for Name: recipe; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.recipe (id, name) FROM stdin;
\.


--
-- Data for Name: recipeitem; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.recipeitem (id, recipe_id, inventory_item_id, qty_required) FROM stdin;
\.


--
-- Data for Name: role; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.role (id, name, description) FROM stdin;
cfa36ef0-652c-47e0-9dbe-b07bcd899dae	Manager	\N
644cb2d7-3dd9-447e-a234-081c2c19d0cf	Baker	\N
0b159d94-a3f8-42ed-bf14-045eb38ea287	Cashier	\N
377880a9-5e4c-48ff-9e4d-44f132caf6ed	Delivery Boy	\N
36dfa0ab-e22e-476a-89a3-e5d390f77d33	Super Admin	\N
7378a739-2869-4c2d-b0e0-7b353fb88d1e	Administrator	\N
a71f471d-4a79-4b62-b97c-74d4f8eace04	Accountant	\N
8b025cac-8b14-4141-8f4f-2c7bb974a13a	Sales User	\N
5eefdc97-af5a-4642-bd8b-a37eab41cd39	Customer/Client	\N
dad98410-211b-4bf7-96f9-f077b4d69ced	Employee	\N
\.


--
-- Data for Name: rolepermission; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.rolepermission (role_id, permission_id) FROM stdin;
377880a9-5e4c-48ff-9e4d-44f132caf6ed	a1d75949-8124-4cdc-925c-5a6df46f9919
377880a9-5e4c-48ff-9e4d-44f132caf6ed	ebf48f30-1d2f-429d-8b41-c435b57f6562
36dfa0ab-e22e-476a-89a3-e5d390f77d33	64533dd4-b153-45fd-8487-4400908b72f6
36dfa0ab-e22e-476a-89a3-e5d390f77d33	d5d14170-a853-47d9-81c6-0f8d9ee21098
36dfa0ab-e22e-476a-89a3-e5d390f77d33	67a8ac95-ef13-41d8-bd7c-c10c6dd779e4
36dfa0ab-e22e-476a-89a3-e5d390f77d33	901336e8-9dce-4e1f-8865-d156f923c758
36dfa0ab-e22e-476a-89a3-e5d390f77d33	71899777-785c-44ed-b64a-d783e22d593b
36dfa0ab-e22e-476a-89a3-e5d390f77d33	1969d306-1928-4078-af30-13221fc671df
36dfa0ab-e22e-476a-89a3-e5d390f77d33	37b44f04-851d-4441-9385-b1e321c9edb6
36dfa0ab-e22e-476a-89a3-e5d390f77d33	8b62a76c-aebe-400d-ada2-1ae97a8f1d8f
36dfa0ab-e22e-476a-89a3-e5d390f77d33	dfae6d14-3cbe-4262-8db4-3abd20cad537
36dfa0ab-e22e-476a-89a3-e5d390f77d33	8c0fedf1-3a51-4b20-8df1-993dec2e0da3
36dfa0ab-e22e-476a-89a3-e5d390f77d33	e2d78d2c-435d-4a54-bb3c-6b94a5a72c52
36dfa0ab-e22e-476a-89a3-e5d390f77d33	075ceded-ac61-49fa-a0bd-900c5a925974
36dfa0ab-e22e-476a-89a3-e5d390f77d33	8e61435d-9ca1-43d8-9faf-f227bed6029d
36dfa0ab-e22e-476a-89a3-e5d390f77d33	bd0873d2-1876-462c-a26f-e4ede301b5d8
36dfa0ab-e22e-476a-89a3-e5d390f77d33	6be41c9c-6221-44cd-beee-2259b0092bdd
36dfa0ab-e22e-476a-89a3-e5d390f77d33	6dcf42ee-d200-4db7-9ed1-8da1fdc8f700
36dfa0ab-e22e-476a-89a3-e5d390f77d33	c59b898c-0b9e-42f5-bdd1-e351613a6b34
36dfa0ab-e22e-476a-89a3-e5d390f77d33	071acda5-abcc-43de-88f1-5a6b0d12a6f2
36dfa0ab-e22e-476a-89a3-e5d390f77d33	dbfce6c0-b8d4-4261-9bdc-b426840e3877
36dfa0ab-e22e-476a-89a3-e5d390f77d33	f5af4b8d-80ad-4b02-8001-764cd9b089ad
36dfa0ab-e22e-476a-89a3-e5d390f77d33	dd79c21f-9e20-447e-a5d6-df244ff8e292
36dfa0ab-e22e-476a-89a3-e5d390f77d33	151a7ae2-3363-4023-a434-121c6160d7bd
36dfa0ab-e22e-476a-89a3-e5d390f77d33	410ec45a-72c4-442d-a7c7-86bb5e12a639
36dfa0ab-e22e-476a-89a3-e5d390f77d33	87014ccc-0901-4bed-866e-4821751763b2
36dfa0ab-e22e-476a-89a3-e5d390f77d33	f969f1d1-fede-411d-81ce-edc58d0a9594
36dfa0ab-e22e-476a-89a3-e5d390f77d33	7bf4aaf0-3e85-445e-85b3-b17af59398a4
36dfa0ab-e22e-476a-89a3-e5d390f77d33	52c8ee40-89fc-46ab-a8a6-5a24e043a266
36dfa0ab-e22e-476a-89a3-e5d390f77d33	489515f3-4deb-4aff-bc11-5e2e642b4fd8
36dfa0ab-e22e-476a-89a3-e5d390f77d33	e0c26039-2dda-4927-8dcb-617b214af5e5
36dfa0ab-e22e-476a-89a3-e5d390f77d33	2da7edab-b0f5-4348-a202-c254c870e322
36dfa0ab-e22e-476a-89a3-e5d390f77d33	48de6454-6b7f-4c19-bd63-e139fe706628
36dfa0ab-e22e-476a-89a3-e5d390f77d33	d1a77e32-8c9b-4825-95c5-a69a01b736fc
36dfa0ab-e22e-476a-89a3-e5d390f77d33	140826e4-e74e-4b20-83f0-b6b422b2dbbb
36dfa0ab-e22e-476a-89a3-e5d390f77d33	faaf1794-fee1-4cc3-9d26-6ac56ac033d3
36dfa0ab-e22e-476a-89a3-e5d390f77d33	0b496c30-16f4-4f44-a214-749a5faca912
36dfa0ab-e22e-476a-89a3-e5d390f77d33	8ee6b1f3-9a34-46ad-ac14-de541879e4a0
36dfa0ab-e22e-476a-89a3-e5d390f77d33	2b2750a9-f31a-47dd-8f13-7d8749088838
36dfa0ab-e22e-476a-89a3-e5d390f77d33	42d47823-4e5c-4ccc-96ba-2ddee795e757
36dfa0ab-e22e-476a-89a3-e5d390f77d33	bb575334-548b-4b75-aad4-43bb2818419b
36dfa0ab-e22e-476a-89a3-e5d390f77d33	8a3df61a-24da-45e6-bade-66223cb5c328
36dfa0ab-e22e-476a-89a3-e5d390f77d33	5250ae79-d50d-469c-9bd3-c5b431d4abc4
36dfa0ab-e22e-476a-89a3-e5d390f77d33	1e8817f2-6de4-4bb7-957d-e0cfbec92298
36dfa0ab-e22e-476a-89a3-e5d390f77d33	b26980f8-5eb1-43d2-903c-851e7c871f0b
36dfa0ab-e22e-476a-89a3-e5d390f77d33	6efb229a-c02d-433a-945b-cc651c01bc01
644cb2d7-3dd9-447e-a234-081c2c19d0cf	bb575334-548b-4b75-aad4-43bb2818419b
36dfa0ab-e22e-476a-89a3-e5d390f77d33	78ee0d43-6c82-4d37-8212-fc6197f4c756
36dfa0ab-e22e-476a-89a3-e5d390f77d33	e695f89d-1a86-4e16-a4c4-c16bccd5786f
36dfa0ab-e22e-476a-89a3-e5d390f77d33	687af0d4-f4b0-4dae-a9d3-c42f900e9e9b
36dfa0ab-e22e-476a-89a3-e5d390f77d33	af584ea5-110d-41c3-992a-9df2d1fd5ba8
cfa36ef0-652c-47e0-9dbe-b07bcd899dae	9d4a95fa-4baf-4b57-8ae6-c9769ac8526f
cfa36ef0-652c-47e0-9dbe-b07bcd899dae	bb575334-548b-4b75-aad4-43bb2818419b
cfa36ef0-652c-47e0-9dbe-b07bcd899dae	8a3df61a-24da-45e6-bade-66223cb5c328
cfa36ef0-652c-47e0-9dbe-b07bcd899dae	5250ae79-d50d-469c-9bd3-c5b431d4abc4
36dfa0ab-e22e-476a-89a3-e5d390f77d33	f1526806-3332-4c27-b539-dbdbf39a7795
36dfa0ab-e22e-476a-89a3-e5d390f77d33	2ee6bd04-9ea4-48f0-a71f-971c7caed907
36dfa0ab-e22e-476a-89a3-e5d390f77d33	44aeabe3-fee1-4ebd-bd92-44990df80ae6
36dfa0ab-e22e-476a-89a3-e5d390f77d33	9453642f-441c-4207-9f72-e075d82aeab9
36dfa0ab-e22e-476a-89a3-e5d390f77d33	0a084f8c-924e-4e58-ae03-fc32fa37818e
36dfa0ab-e22e-476a-89a3-e5d390f77d33	2f572c34-c1bf-4092-b653-68804dd8f9b3
36dfa0ab-e22e-476a-89a3-e5d390f77d33	2e023eb1-9c56-4545-b08c-7711dcbb5af9
36dfa0ab-e22e-476a-89a3-e5d390f77d33	981105e4-0bf6-44dc-a9f6-7939ce50d9ec
36dfa0ab-e22e-476a-89a3-e5d390f77d33	6cab2a75-2498-45fc-92f4-b9b050ae3ae2
36dfa0ab-e22e-476a-89a3-e5d390f77d33	9d4a95fa-4baf-4b57-8ae6-c9769ac8526f
36dfa0ab-e22e-476a-89a3-e5d390f77d33	b78d27f4-930d-4453-a3ab-91453f1431c9
36dfa0ab-e22e-476a-89a3-e5d390f77d33	62d2a8c9-7a63-4cf5-9f8d-b15588d671df
36dfa0ab-e22e-476a-89a3-e5d390f77d33	0955ac7f-835e-409f-a5b5-122abad1096c
36dfa0ab-e22e-476a-89a3-e5d390f77d33	5e8de4d1-8616-47f9-8844-6a671ec61a5f
36dfa0ab-e22e-476a-89a3-e5d390f77d33	e0291750-6f8e-44a8-98fa-c547162664bf
36dfa0ab-e22e-476a-89a3-e5d390f77d33	ce037ca5-e3ca-4a85-a84f-f020f59e7694
36dfa0ab-e22e-476a-89a3-e5d390f77d33	8984afc6-5019-4fe8-b9a5-e60456785c06
36dfa0ab-e22e-476a-89a3-e5d390f77d33	1ea044ba-14f2-4dc9-a2f7-a9fafd20dff5
36dfa0ab-e22e-476a-89a3-e5d390f77d33	fd72dad8-9cc8-4d11-add0-7535711d57ea
36dfa0ab-e22e-476a-89a3-e5d390f77d33	6a98d096-4c96-476f-8d05-f0c84ef6f312
36dfa0ab-e22e-476a-89a3-e5d390f77d33	f253db10-621e-4a7e-899f-1ff6d8e2f21a
36dfa0ab-e22e-476a-89a3-e5d390f77d33	ee8e2e57-b02d-477c-b9bd-485230ec3861
36dfa0ab-e22e-476a-89a3-e5d390f77d33	c01aeee6-b96c-4a8a-b799-81a82218cef8
36dfa0ab-e22e-476a-89a3-e5d390f77d33	c1aeace5-dc07-4646-bf8f-75ac33530ab6
36dfa0ab-e22e-476a-89a3-e5d390f77d33	a9f57870-c778-4de7-97e2-0bb926ef34bc
36dfa0ab-e22e-476a-89a3-e5d390f77d33	a1d75949-8124-4cdc-925c-5a6df46f9919
36dfa0ab-e22e-476a-89a3-e5d390f77d33	ebf48f30-1d2f-429d-8b41-c435b57f6562
36dfa0ab-e22e-476a-89a3-e5d390f77d33	85666fc6-2709-412d-8265-9b33b92424e1
36dfa0ab-e22e-476a-89a3-e5d390f77d33	29dae6cf-3d0e-4e9c-acad-e3dc8aba6b9e
cfa36ef0-652c-47e0-9dbe-b07bcd899dae	1e8817f2-6de4-4bb7-957d-e0cfbec92298
cfa36ef0-652c-47e0-9dbe-b07bcd899dae	b26980f8-5eb1-43d2-903c-851e7c871f0b
cfa36ef0-652c-47e0-9dbe-b07bcd899dae	6efb229a-c02d-433a-945b-cc651c01bc01
36dfa0ab-e22e-476a-89a3-e5d390f77d33	8ae64777-b44d-4e66-8ea9-9f8abad60b0b
36dfa0ab-e22e-476a-89a3-e5d390f77d33	7f55188d-85a4-4272-a470-6ad01230696a
36dfa0ab-e22e-476a-89a3-e5d390f77d33	5e6c6ba6-a567-41c7-980b-afcb72860a88
36dfa0ab-e22e-476a-89a3-e5d390f77d33	736bc512-fdc3-4f07-bf16-a05540291795
36dfa0ab-e22e-476a-89a3-e5d390f77d33	f2ec55d9-e24e-4fde-9111-2cace1a2e3ed
36dfa0ab-e22e-476a-89a3-e5d390f77d33	dcaebb1b-35c1-406c-b8fa-a461d059978b
36dfa0ab-e22e-476a-89a3-e5d390f77d33	70b5dee0-31dd-4066-b79b-9a41a5fc1d54
36dfa0ab-e22e-476a-89a3-e5d390f77d33	279578e1-4652-499e-ab60-57016c2f5d08
36dfa0ab-e22e-476a-89a3-e5d390f77d33	9f3658f1-d2c2-405d-9c3f-ba0d0a051ef2
36dfa0ab-e22e-476a-89a3-e5d390f77d33	041aebe6-15d8-4401-bd55-bac4d665bcda
36dfa0ab-e22e-476a-89a3-e5d390f77d33	fb611a91-3a35-40f2-8d73-3c654e78d7c8
36dfa0ab-e22e-476a-89a3-e5d390f77d33	933d9e48-f59d-4ae5-af58-2434403b0543
36dfa0ab-e22e-476a-89a3-e5d390f77d33	806b8f84-3b4c-4e97-916b-56f5a1db11ae
36dfa0ab-e22e-476a-89a3-e5d390f77d33	ac2581fb-f02b-44f1-bf0c-d607715c4a78
644cb2d7-3dd9-447e-a234-081c2c19d0cf	ac2581fb-f02b-44f1-bf0c-d607715c4a78
644cb2d7-3dd9-447e-a234-081c2c19d0cf	f2ec55d9-e24e-4fde-9111-2cace1a2e3ed
644cb2d7-3dd9-447e-a234-081c2c19d0cf	dcaebb1b-35c1-406c-b8fa-a461d059978b
644cb2d7-3dd9-447e-a234-081c2c19d0cf	9f3658f1-d2c2-405d-9c3f-ba0d0a051ef2
36dfa0ab-e22e-476a-89a3-e5d390f77d33	c4f71cde-2260-4024-bf75-21ee65b9cba9
36dfa0ab-e22e-476a-89a3-e5d390f77d33	6ad0d67e-d3ad-4156-a545-73935c3b2514
377880a9-5e4c-48ff-9e4d-44f132caf6ed	bb575334-548b-4b75-aad4-43bb2818419b
377880a9-5e4c-48ff-9e4d-44f132caf6ed	c4f71cde-2260-4024-bf75-21ee65b9cba9
377880a9-5e4c-48ff-9e4d-44f132caf6ed	6ad0d67e-d3ad-4156-a545-73935c3b2514
36dfa0ab-e22e-476a-89a3-e5d390f77d33	b3f1cf91-7952-4062-81a0-1c6ed49fa799
36dfa0ab-e22e-476a-89a3-e5d390f77d33	476b5194-c9a4-4c4c-aaa3-51e6211a3124
36dfa0ab-e22e-476a-89a3-e5d390f77d33	efd4a83a-2734-4d99-a7ed-8be6d9703b36
36dfa0ab-e22e-476a-89a3-e5d390f77d33	8ae352d5-2f4a-4822-9bf7-3dafdf3cfc45
36dfa0ab-e22e-476a-89a3-e5d390f77d33	5e82d89f-7268-4a32-8bce-85774be0e186
36dfa0ab-e22e-476a-89a3-e5d390f77d33	fab34bc9-203b-439a-8737-3a19bc56aeda
36dfa0ab-e22e-476a-89a3-e5d390f77d33	c7b5e94e-c7a5-4bb3-9d3d-f12624c34e20
36dfa0ab-e22e-476a-89a3-e5d390f77d33	56d02e98-2992-4178-9b35-615751c275be
36dfa0ab-e22e-476a-89a3-e5d390f77d33	12d5951d-fac8-4a9c-9aab-9442a7380d6f
\.


--
-- Data for Name: staff; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.staff (id, full_name, email, hashed_password, is_active, created_at, failed_login_attempts, locked_until, password_updated_at, totp_secret, totp_enabled, password_changed_at, must_change_password, two_factor_enabled, two_factor_secret, preferred_language, theme_preference, color_palette, phone, job_title, employee_code, date_of_joining, branch_id, department, date_of_birth, gender, national_id, employment_type, basic_salary, address_line1, city, country, emergency_contact_name, emergency_contact_phone) FROM stdin;
0746779e-c05d-406a-9a78-2121750c114f	Studio Owner	owner@cakestudio.local	$2b$12$1oocYkNsCjCMimHagUbDWO./FHIomfNjOZTuimeLt/vlx/SNUQoDS	t	2026-08-11 16:18:48.352101+05	0	\N	2026-08-11 16:18:48.352101+05	\N	f	2026-08-12 17:02:00.394186+05	f	f	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N
ab242ada-05ef-4ed4-94bf-b300bc8c05dd	Ayyan	ayyan@gmail.com	$2b$12$WBoqIV5B34s55SmZLsCtRuFptF6yeJXV2i1wzMcto0XHYtndUxAzK	t	2026-08-13 13:13:46.070822+05	0	\N	2026-08-13 13:13:46.070831+05	\N	f	2026-08-13 13:13:46.071189+05	f	f	\N	en	light	ocean	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N
33b6d222-3061-41e3-b558-fa682996e17f	Khizar Qadri	khizarqadri92@gmail.com	$2b$12$HLaFUfbF6sKknBbEhkHbNeYrbd.CLm8kvfWxRJYsOum.dp0ibE4hy	t	2026-08-12 10:47:33.677463+05	0	\N	2026-08-12 18:04:30.743166+05	\N	f	2026-08-12 17:02:00.394186+05	f	f	\N	en	light	slate	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N
d7c143c3-72a0-43ba-a3b1-5964cffa522c	Ume Kalsoom	kalsoom@gmail.com	$2b$12$tWUZchMSLZa4D7xYka7cj.WiNuPbkcfigWrHwD7IyR.E2OT/HLHbW	t	2026-09-15 22:19:06.39069+05	0	\N	2026-09-15 22:19:06.390695+05	\N	f	2026-09-15 22:19:06.412444+05	f	f	\N	\N	light	\N		Baker	CS-0002	2026-05-07	05267d89-49af-4e91-941f-befa8de8b305		1973-03-23	female		full_time	50000					
bb7f0a40-2b83-41d5-b2cc-873db2434876	Rawaidah Nadeem	rawaidah@gmail.com	$2b$12$FuUBuphP5kSBmSmJYbnfAOnkzqHhTKmWK6MLDFXUzQs1kvv2aBT86	t	2026-08-16 16:26:57.000614+05	0	\N	2026-08-16 16:26:57.000624+05	QMK3G4P3B3T2FDWPE4GQOAOUP6L535J6	f	2026-08-16 16:26:57.03068+05	f	f	\N	\N	light	forest	03424943054	Baker	EMP-0001	2026-01-01	05267d89-49af-4e91-941f-befa8de8b305		2008-05-01	female		full_time	25000	59 Railway road	Renala Khurd	Pakistan	Khizar	
\.


--
-- Data for Name: staffpermissionoverride; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.staffpermissionoverride (staff_id, permission_id, effect, reason) FROM stdin;
\.


--
-- Data for Name: staffrole; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.staffrole (staff_id, role_id) FROM stdin;
0746779e-c05d-406a-9a78-2121750c114f	36dfa0ab-e22e-476a-89a3-e5d390f77d33
33b6d222-3061-41e3-b558-fa682996e17f	36dfa0ab-e22e-476a-89a3-e5d390f77d33
ab242ada-05ef-4ed4-94bf-b300bc8c05dd	377880a9-5e4c-48ff-9e4d-44f132caf6ed
bb7f0a40-2b83-41d5-b2cc-873db2434876	644cb2d7-3dd9-447e-a234-081c2c19d0cf
d7c143c3-72a0-43ba-a3b1-5964cffa522c	644cb2d7-3dd9-447e-a234-081c2c19d0cf
\.


--
-- Data for Name: stockmovement; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.stockmovement (id, inventory_item_id, qty_delta, reason, processing_date, created_by_staff_id, created_at, unit_price, purchase_id) FROM stdin;
\.


--
-- Data for Name: supplier; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.supplier (id, name, contact_phone) FROM stdin;
17fcdab4-09da-4a3f-926c-68d362ccd18f	Osama Super Store	03002565232
aa9027e5-90c9-4b89-a4db-dfecd8d793fc	Bake House	\N
\.


--
-- Data for Name: systemconfig; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.systemconfig (id, current_processing_date, fiscal_year_start_month, is_day_locked, updated_at, amount_decimals, quantity_decimals, printer_mode, printer_host, printer_port, printer_width, phone_country_code, date_mode) FROM stdin;
1	2026-09-26	1	f	2026-09-26 15:20:45.561009+05	2	3	browser	\N	9100	48	92	system
\.


--
-- Data for Name: theme; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.theme (id, name, description, image_url, is_active, sort_order) FROM stdin;
bb06fc71-b3a1-4c06-8272-651087e778f3	Birthday	Birthday celebrations	\N	t	0
b7f36dc5-d127-49a7-8269-e12f9c5e1afd	Wedding	Wedding cakes	\N	t	1
aaf36685-d59b-4f2e-974c-44f76c79e023	Baby Shower	Baby shower celebrations	\N	t	2
71f56b92-fc86-417e-8f9b-e6055b81aa81	Anniversary	Anniversary celebrations	\N	t	3
\.


--
-- Data for Name: unitofmeasure; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.unitofmeasure (id, name, abbreviation, is_active, sort_order, measure, factor) FROM stdin;
8779792c-d8a8-43ff-9001-a8a322a755b1	Kilogram	kg	t	0	weight	1000
7cd56a67-9f36-4157-b35d-f2e48b08affd	Grams	g	t	0	weight	1
462b3a59-6b6b-43e2-b26d-01e107553b74	Pieces	pcs	t	0	count	1
d5205235-e515-4988-812e-f3c8d8b09aec	Liters	ltr	t	0	volume	1000
76d70012-e8f2-4a51-b753-0a67367b9226	Dozen	dzn	t	0	count	12
ac5cc29a-e4bf-4cde-9512-f9bc6d1b4c33	Millilitre	ml	t	0	volume	1
\.


--
-- Name: accesspolicy_id_seq; Type: SEQUENCE SET; Schema: public; Owner: -
--

SELECT pg_catalog.setval('public.accesspolicy_id_seq', 1, false);


--
-- Name: employeecodesettings_id_seq; Type: SEQUENCE SET; Schema: public; Owner: -
--

SELECT pg_catalog.setval('public.employeecodesettings_id_seq', 1, false);


--
-- Name: ordersequence_id_seq; Type: SEQUENCE SET; Schema: public; Owner: -
--

SELECT pg_catalog.setval('public.ordersequence_id_seq', 1, false);


--
-- Name: organization_id_seq; Type: SEQUENCE SET; Schema: public; Owner: -
--

SELECT pg_catalog.setval('public.organization_id_seq', 1, false);


--
-- Name: systemconfig_id_seq; Type: SEQUENCE SET; Schema: public; Owner: -
--

SELECT pg_catalog.setval('public.systemconfig_id_seq', 1, false);


--
-- Name: accesspolicy accesspolicy_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.accesspolicy
    ADD CONSTRAINT accesspolicy_pkey PRIMARY KEY (id);


--
-- Name: alembic_version alembic_version_pkc; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.alembic_version
    ADD CONSTRAINT alembic_version_pkc PRIMARY KEY (version_num);


--
-- Name: auditlog auditlog_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.auditlog
    ADD CONSTRAINT auditlog_pkey PRIMARY KEY (id);


--
-- Name: branch branch_code_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.branch
    ADD CONSTRAINT branch_code_key UNIQUE (code);


--
-- Name: branch branch_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.branch
    ADD CONSTRAINT branch_pkey PRIMARY KEY (id);


--
-- Name: branchfieldaccess branchfieldaccess_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.branchfieldaccess
    ADD CONSTRAINT branchfieldaccess_pkey PRIMARY KEY (id);


--
-- Name: cakeaddon cakeaddon_name_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.cakeaddon
    ADD CONSTRAINT cakeaddon_name_key UNIQUE (name);


--
-- Name: cakeaddon cakeaddon_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.cakeaddon
    ADD CONSTRAINT cakeaddon_pkey PRIMARY KEY (id);


--
-- Name: cakebox cakebox_name_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.cakebox
    ADD CONSTRAINT cakebox_name_key UNIQUE (name);


--
-- Name: cakebox cakebox_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.cakebox
    ADD CONSTRAINT cakebox_pkey PRIMARY KEY (id);


--
-- Name: cakecolor cakecolor_name_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.cakecolor
    ADD CONSTRAINT cakecolor_name_key UNIQUE (name);


--
-- Name: cakecolor cakecolor_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.cakecolor
    ADD CONSTRAINT cakecolor_pkey PRIMARY KEY (id);


--
-- Name: cakefilling cakefilling_name_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.cakefilling
    ADD CONSTRAINT cakefilling_name_key UNIQUE (name);


--
-- Name: cakefilling cakefilling_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.cakefilling
    ADD CONSTRAINT cakefilling_pkey PRIMARY KEY (id);


--
-- Name: cakeflavor cakeflavor_name_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.cakeflavor
    ADD CONSTRAINT cakeflavor_name_key UNIQUE (name);


--
-- Name: cakeflavor cakeflavor_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.cakeflavor
    ADD CONSTRAINT cakeflavor_pkey PRIMARY KEY (id);


--
-- Name: cakefrosting cakefrosting_name_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.cakefrosting
    ADD CONSTRAINT cakefrosting_name_key UNIQUE (name);


--
-- Name: cakefrosting cakefrosting_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.cakefrosting
    ADD CONSTRAINT cakefrosting_pkey PRIMARY KEY (id);


--
-- Name: cakeshape cakeshape_name_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.cakeshape
    ADD CONSTRAINT cakeshape_name_key UNIQUE (name);


--
-- Name: cakeshape cakeshape_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.cakeshape
    ADD CONSTRAINT cakeshape_pkey PRIMARY KEY (id);


--
-- Name: cakesize cakesize_name_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.cakesize
    ADD CONSTRAINT cakesize_name_key UNIQUE (name);


--
-- Name: cakesize cakesize_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.cakesize
    ADD CONSTRAINT cakesize_pkey PRIMARY KEY (id);


--
-- Name: caketier caketier_name_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.caketier
    ADD CONSTRAINT caketier_name_key UNIQUE (name);


--
-- Name: caketier caketier_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.caketier
    ADD CONSTRAINT caketier_pkey PRIMARY KEY (id);


--
-- Name: customer customer_phone_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.customer
    ADD CONSTRAINT customer_phone_key UNIQUE (phone);


--
-- Name: customer customer_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.customer
    ADD CONSTRAINT customer_pkey PRIMARY KEY (id);


--
-- Name: deliveryzone deliveryzone_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.deliveryzone
    ADD CONSTRAINT deliveryzone_pkey PRIMARY KEY (id);


--
-- Name: employeecodesettings employeecodesettings_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.employeecodesettings
    ADD CONSTRAINT employeecodesettings_pkey PRIMARY KEY (id);


--
-- Name: expense expense_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.expense
    ADD CONSTRAINT expense_pkey PRIMARY KEY (id);


--
-- Name: inventoryitem inventoryitem_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.inventoryitem
    ADD CONSTRAINT inventoryitem_pkey PRIMARY KEY (id);


--
-- Name: loginhistory loginhistory_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.loginhistory
    ADD CONSTRAINT loginhistory_pkey PRIMARY KEY (id);


--
-- Name: order order_order_number_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."order"
    ADD CONSTRAINT order_order_number_key UNIQUE (order_number);


--
-- Name: order order_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."order"
    ADD CONSTRAINT order_pkey PRIMARY KEY (id);


--
-- Name: orderingredientusage orderingredientusage_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.orderingredientusage
    ADD CONSTRAINT orderingredientusage_pkey PRIMARY KEY (id);


--
-- Name: orderitem orderitem_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.orderitem
    ADD CONSTRAINT orderitem_pkey PRIMARY KEY (id);


--
-- Name: orderitemaddon orderitemaddon_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.orderitemaddon
    ADD CONSTRAINT orderitemaddon_pkey PRIMARY KEY (id);


--
-- Name: ordersequence ordersequence_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.ordersequence
    ADD CONSTRAINT ordersequence_pkey PRIMARY KEY (id);


--
-- Name: organization organization_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.organization
    ADD CONSTRAINT organization_pkey PRIMARY KEY (id);


--
-- Name: permission permission_key_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.permission
    ADD CONSTRAINT permission_key_key UNIQUE (key);


--
-- Name: permission permission_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.permission
    ADD CONSTRAINT permission_pkey PRIMARY KEY (id);


--
-- Name: printjob printjob_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.printjob
    ADD CONSTRAINT printjob_pkey PRIMARY KEY (id);


--
-- Name: processingdatelog processingdatelog_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.processingdatelog
    ADD CONSTRAINT processingdatelog_pkey PRIMARY KEY (id);


--
-- Name: purchase purchase_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.purchase
    ADD CONSTRAINT purchase_pkey PRIMARY KEY (id);


--
-- Name: purchaseitem purchaseitem_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.purchaseitem
    ADD CONSTRAINT purchaseitem_pkey PRIMARY KEY (id);


--
-- Name: recipe recipe_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.recipe
    ADD CONSTRAINT recipe_pkey PRIMARY KEY (id);


--
-- Name: recipeitem recipeitem_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.recipeitem
    ADD CONSTRAINT recipeitem_pkey PRIMARY KEY (id);


--
-- Name: role role_name_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.role
    ADD CONSTRAINT role_name_key UNIQUE (name);


--
-- Name: role role_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.role
    ADD CONSTRAINT role_pkey PRIMARY KEY (id);


--
-- Name: rolepermission rolepermission_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.rolepermission
    ADD CONSTRAINT rolepermission_pkey PRIMARY KEY (role_id, permission_id);


--
-- Name: staff staff_email_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.staff
    ADD CONSTRAINT staff_email_key UNIQUE (email);


--
-- Name: staff staff_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.staff
    ADD CONSTRAINT staff_pkey PRIMARY KEY (id);


--
-- Name: staffpermissionoverride staffpermissionoverride_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.staffpermissionoverride
    ADD CONSTRAINT staffpermissionoverride_pkey PRIMARY KEY (staff_id, permission_id);


--
-- Name: staffrole staffrole_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.staffrole
    ADD CONSTRAINT staffrole_pkey PRIMARY KEY (staff_id, role_id);


--
-- Name: stockmovement stockmovement_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.stockmovement
    ADD CONSTRAINT stockmovement_pkey PRIMARY KEY (id);


--
-- Name: supplier supplier_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.supplier
    ADD CONSTRAINT supplier_pkey PRIMARY KEY (id);


--
-- Name: systemconfig systemconfig_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.systemconfig
    ADD CONSTRAINT systemconfig_pkey PRIMARY KEY (id);


--
-- Name: theme theme_name_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.theme
    ADD CONSTRAINT theme_name_key UNIQUE (name);


--
-- Name: theme theme_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.theme
    ADD CONSTRAINT theme_pkey PRIMARY KEY (id);


--
-- Name: unitofmeasure unitofmeasure_name_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.unitofmeasure
    ADD CONSTRAINT unitofmeasure_name_key UNIQUE (name);


--
-- Name: unitofmeasure unitofmeasure_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.unitofmeasure
    ADD CONSTRAINT unitofmeasure_pkey PRIMARY KEY (id);


--
-- Name: branchfieldaccess uq_role_branch_section_field; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.branchfieldaccess
    ADD CONSTRAINT uq_role_branch_section_field UNIQUE (role_id, branch_id, section_key, field_key);


--
-- Name: staff uq_staff_employee_code; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.staff
    ADD CONSTRAINT uq_staff_employee_code UNIQUE (employee_code);


--
-- Name: ix_printjob_order_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX ix_printjob_order_id ON public.printjob USING btree (order_id);


--
-- Name: accesspolicy accesspolicy_default_role_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.accesspolicy
    ADD CONSTRAINT accesspolicy_default_role_id_fkey FOREIGN KEY (default_role_id) REFERENCES public.role(id);


--
-- Name: auditlog auditlog_actor_staff_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.auditlog
    ADD CONSTRAINT auditlog_actor_staff_id_fkey FOREIGN KEY (actor_staff_id) REFERENCES public.staff(id);


--
-- Name: branch branch_manager_staff_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.branch
    ADD CONSTRAINT branch_manager_staff_id_fkey FOREIGN KEY (manager_staff_id) REFERENCES public.staff(id);


--
-- Name: branchfieldaccess branchfieldaccess_branch_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.branchfieldaccess
    ADD CONSTRAINT branchfieldaccess_branch_id_fkey FOREIGN KEY (branch_id) REFERENCES public.branch(id);


--
-- Name: branchfieldaccess branchfieldaccess_role_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.branchfieldaccess
    ADD CONSTRAINT branchfieldaccess_role_id_fkey FOREIGN KEY (role_id) REFERENCES public.role(id);


--
-- Name: expense expense_recorded_by_staff_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.expense
    ADD CONSTRAINT expense_recorded_by_staff_id_fkey FOREIGN KEY (recorded_by_staff_id) REFERENCES public.staff(id);


--
-- Name: inventoryitem inventoryitem_supplier_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.inventoryitem
    ADD CONSTRAINT inventoryitem_supplier_id_fkey FOREIGN KEY (supplier_id) REFERENCES public.supplier(id);


--
-- Name: inventoryitem inventoryitem_unit_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.inventoryitem
    ADD CONSTRAINT inventoryitem_unit_id_fkey FOREIGN KEY (unit_id) REFERENCES public.unitofmeasure(id);


--
-- Name: loginhistory loginhistory_staff_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.loginhistory
    ADD CONSTRAINT loginhistory_staff_id_fkey FOREIGN KEY (staff_id) REFERENCES public.staff(id);


--
-- Name: order order_baker_staff_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."order"
    ADD CONSTRAINT order_baker_staff_id_fkey FOREIGN KEY (baker_staff_id) REFERENCES public.staff(id);


--
-- Name: order order_branch_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."order"
    ADD CONSTRAINT order_branch_id_fkey FOREIGN KEY (branch_id) REFERENCES public.branch(id);


--
-- Name: order order_confirmed_by_staff_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."order"
    ADD CONSTRAINT order_confirmed_by_staff_id_fkey FOREIGN KEY (confirmed_by_staff_id) REFERENCES public.staff(id);


--
-- Name: order order_created_by_staff_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."order"
    ADD CONSTRAINT order_created_by_staff_id_fkey FOREIGN KEY (created_by_staff_id) REFERENCES public.staff(id);


--
-- Name: order order_customer_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."order"
    ADD CONSTRAINT order_customer_id_fkey FOREIGN KEY (customer_id) REFERENCES public.customer(id);


--
-- Name: order order_declined_by_staff_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."order"
    ADD CONSTRAINT order_declined_by_staff_id_fkey FOREIGN KEY (declined_by_staff_id) REFERENCES public.staff(id);


--
-- Name: order order_delivery_zone_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."order"
    ADD CONSTRAINT order_delivery_zone_id_fkey FOREIGN KEY (delivery_zone_id) REFERENCES public.deliveryzone(id);


--
-- Name: order order_handover_by_staff_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."order"
    ADD CONSTRAINT order_handover_by_staff_id_fkey FOREIGN KEY (handover_by_staff_id) REFERENCES public.staff(id);


--
-- Name: order order_rider_staff_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."order"
    ADD CONSTRAINT order_rider_staff_id_fkey FOREIGN KEY (rider_staff_id) REFERENCES public.staff(id);


--
-- Name: order order_sent_to_baker_by_staff_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."order"
    ADD CONSTRAINT order_sent_to_baker_by_staff_id_fkey FOREIGN KEY (sent_to_baker_by_staff_id) REFERENCES public.staff(id);


--
-- Name: orderingredientusage orderingredientusage_inventory_item_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.orderingredientusage
    ADD CONSTRAINT orderingredientusage_inventory_item_id_fkey FOREIGN KEY (inventory_item_id) REFERENCES public.inventoryitem(id);


--
-- Name: orderingredientusage orderingredientusage_order_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.orderingredientusage
    ADD CONSTRAINT orderingredientusage_order_id_fkey FOREIGN KEY (order_id) REFERENCES public."order"(id);


--
-- Name: orderingredientusage orderingredientusage_recorded_by_staff_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.orderingredientusage
    ADD CONSTRAINT orderingredientusage_recorded_by_staff_id_fkey FOREIGN KEY (recorded_by_staff_id) REFERENCES public.staff(id);


--
-- Name: orderitem orderitem_cake_box_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.orderitem
    ADD CONSTRAINT orderitem_cake_box_id_fkey FOREIGN KEY (cake_box_id) REFERENCES public.cakebox(id);


--
-- Name: orderitem orderitem_cake_color_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.orderitem
    ADD CONSTRAINT orderitem_cake_color_id_fkey FOREIGN KEY (cake_color_id) REFERENCES public.cakecolor(id);


--
-- Name: orderitem orderitem_cake_filling_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.orderitem
    ADD CONSTRAINT orderitem_cake_filling_id_fkey FOREIGN KEY (cake_filling_id) REFERENCES public.cakefilling(id);


--
-- Name: orderitem orderitem_cake_flavor_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.orderitem
    ADD CONSTRAINT orderitem_cake_flavor_id_fkey FOREIGN KEY (cake_flavor_id) REFERENCES public.cakeflavor(id);


--
-- Name: orderitem orderitem_cake_frosting_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.orderitem
    ADD CONSTRAINT orderitem_cake_frosting_id_fkey FOREIGN KEY (cake_frosting_id) REFERENCES public.cakefrosting(id);


--
-- Name: orderitem orderitem_cake_shape_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.orderitem
    ADD CONSTRAINT orderitem_cake_shape_id_fkey FOREIGN KEY (cake_shape_id) REFERENCES public.cakeshape(id);


--
-- Name: orderitem orderitem_cake_size_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.orderitem
    ADD CONSTRAINT orderitem_cake_size_id_fkey FOREIGN KEY (cake_size_id) REFERENCES public.cakesize(id);


--
-- Name: orderitem orderitem_cake_tier_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.orderitem
    ADD CONSTRAINT orderitem_cake_tier_id_fkey FOREIGN KEY (cake_tier_id) REFERENCES public.caketier(id);


--
-- Name: orderitem orderitem_order_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.orderitem
    ADD CONSTRAINT orderitem_order_id_fkey FOREIGN KEY (order_id) REFERENCES public."order"(id);


--
-- Name: orderitem orderitem_theme_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.orderitem
    ADD CONSTRAINT orderitem_theme_id_fkey FOREIGN KEY (theme_id) REFERENCES public.theme(id);


--
-- Name: orderitemaddon orderitemaddon_addon_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.orderitemaddon
    ADD CONSTRAINT orderitemaddon_addon_id_fkey FOREIGN KEY (addon_id) REFERENCES public.cakeaddon(id);


--
-- Name: orderitemaddon orderitemaddon_order_item_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.orderitemaddon
    ADD CONSTRAINT orderitemaddon_order_item_id_fkey FOREIGN KEY (order_item_id) REFERENCES public.orderitem(id);


--
-- Name: printjob printjob_created_by_staff_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.printjob
    ADD CONSTRAINT printjob_created_by_staff_id_fkey FOREIGN KEY (created_by_staff_id) REFERENCES public.staff(id);


--
-- Name: printjob printjob_order_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.printjob
    ADD CONSTRAINT printjob_order_id_fkey FOREIGN KEY (order_id) REFERENCES public."order"(id);


--
-- Name: processingdatelog processingdatelog_changed_by_staff_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.processingdatelog
    ADD CONSTRAINT processingdatelog_changed_by_staff_id_fkey FOREIGN KEY (changed_by_staff_id) REFERENCES public.staff(id);


--
-- Name: purchase purchase_created_by_staff_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.purchase
    ADD CONSTRAINT purchase_created_by_staff_id_fkey FOREIGN KEY (created_by_staff_id) REFERENCES public.staff(id);


--
-- Name: purchase purchase_supplier_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.purchase
    ADD CONSTRAINT purchase_supplier_id_fkey FOREIGN KEY (supplier_id) REFERENCES public.supplier(id);


--
-- Name: purchaseitem purchaseitem_inventory_item_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.purchaseitem
    ADD CONSTRAINT purchaseitem_inventory_item_id_fkey FOREIGN KEY (inventory_item_id) REFERENCES public.inventoryitem(id);


--
-- Name: purchaseitem purchaseitem_purchase_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.purchaseitem
    ADD CONSTRAINT purchaseitem_purchase_id_fkey FOREIGN KEY (purchase_id) REFERENCES public.purchase(id);


--
-- Name: recipeitem recipeitem_inventory_item_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.recipeitem
    ADD CONSTRAINT recipeitem_inventory_item_id_fkey FOREIGN KEY (inventory_item_id) REFERENCES public.inventoryitem(id);


--
-- Name: recipeitem recipeitem_recipe_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.recipeitem
    ADD CONSTRAINT recipeitem_recipe_id_fkey FOREIGN KEY (recipe_id) REFERENCES public.recipe(id);


--
-- Name: rolepermission rolepermission_permission_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.rolepermission
    ADD CONSTRAINT rolepermission_permission_id_fkey FOREIGN KEY (permission_id) REFERENCES public.permission(id);


--
-- Name: rolepermission rolepermission_role_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.rolepermission
    ADD CONSTRAINT rolepermission_role_id_fkey FOREIGN KEY (role_id) REFERENCES public.role(id);


--
-- Name: staff staff_branch_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.staff
    ADD CONSTRAINT staff_branch_id_fkey FOREIGN KEY (branch_id) REFERENCES public.branch(id);


--
-- Name: staffpermissionoverride staffpermissionoverride_permission_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.staffpermissionoverride
    ADD CONSTRAINT staffpermissionoverride_permission_id_fkey FOREIGN KEY (permission_id) REFERENCES public.permission(id);


--
-- Name: staffpermissionoverride staffpermissionoverride_staff_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.staffpermissionoverride
    ADD CONSTRAINT staffpermissionoverride_staff_id_fkey FOREIGN KEY (staff_id) REFERENCES public.staff(id);


--
-- Name: staffrole staffrole_role_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.staffrole
    ADD CONSTRAINT staffrole_role_id_fkey FOREIGN KEY (role_id) REFERENCES public.role(id);


--
-- Name: staffrole staffrole_staff_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.staffrole
    ADD CONSTRAINT staffrole_staff_id_fkey FOREIGN KEY (staff_id) REFERENCES public.staff(id);


--
-- Name: stockmovement stockmovement_created_by_staff_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.stockmovement
    ADD CONSTRAINT stockmovement_created_by_staff_id_fkey FOREIGN KEY (created_by_staff_id) REFERENCES public.staff(id);


--
-- Name: stockmovement stockmovement_inventory_item_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.stockmovement
    ADD CONSTRAINT stockmovement_inventory_item_id_fkey FOREIGN KEY (inventory_item_id) REFERENCES public.inventoryitem(id);


--
-- Name: stockmovement stockmovement_purchase_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.stockmovement
    ADD CONSTRAINT stockmovement_purchase_id_fkey FOREIGN KEY (purchase_id) REFERENCES public.purchase(id);


--
-- PostgreSQL database dump complete
--

\unrestrict v89CUIf98NnigJMsTpAD7jxBKJm33xMFBcT92dIeOAFQLGKNIdYfogVU4Tsoll5

